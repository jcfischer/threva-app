# Homebrew install sandbox measurement

Measured on 2026-11-16 for #134, under the installer decision in #7.

## Finding

The tested personal-tap formula successfully ran `bun install --frozen-lockfile` for threva-app, `bun run build` for Threva, and `bun install --frozen-lockfile` for Cortex, during `brew install --build-from-source`. An exclusive write outside Homebrew's build directories was denied in that same install, demonstrating that the sandbox was active. No `disableSandbox` option or `--no-sandbox` flag was used.

These pinned sources can use the source-build path on this host. This does not establish that every release, dependency server or macOS installation will behave identically, or test the real installer formula.

## Versions and inputs

| Input | Measured value |
| --- | --- |
| Homebrew | `7.0.13-156-gf8508d1` |
| macOS | `27.2.1`, build `26B131`, Apple Silicon |
| Bun | Existing `~/.bun/bin/bun`, `1.4.4` (`38afee6c8`); no Homebrew Bun dependency was installed |
| Cortex resource | Tag `v6.30.0`; SHA-256 `887075c2e94275485a581204ee47e774cb430aacfbbdf17cabc020cd2cb3954b` |
| Threva source | Commit `70a904c6f596c7e810ea58a2f56c9fba9312407a`; SHA-256 `de40566b43501d3c9fb837166fc72bf1917c10baf62af81e536c5205f7c1e43b` |

Both source tarballs were already in Homebrew's download cache; their checksums were independently checked before the install, and Homebrew verified them again. `BUN_INSTALL_CACHE_DIR` pointed at a fresh directory inside this formula's build directory. The measurement did not provision Bun, and did not use forge or model credentials.

## Formula and commands

The throwaway tap was `local/threva134-probe`. The formula's complete source follows. Only the host home directory is represented as `<host-home>` in the formula and output below; the run used its literal absolute path. The control directory was created by `mktemp -d` before the install and its marker did not exist. `File::EXCL` prevents an existing file from being overwritten.

```ruby
class Threva134Probe < Formula
  desc "Throwaway measurement for threva-app node 134"
  homepage "https://github.com/jcfischer/threva-app"
  url "https://github.com/jcfischer/threva-app/archive/70a904c6f596c7e810ea58a2f56c9fba9312407a.tar.gz"
  sha256 "de40566b43501d3c9fb837166fc72bf1917c10baf62af81e536c5205f7c1e43b"
  version "0.0.0"
  license "AGPL-3.0-only"

  resource "cortex" do
    url "https://github.com/the-metafactory/cortex/archive/refs/tags/v6.30.0.tar.gz"
    sha256 "887075c2e94275485a581204ee47e774cb430aacfbbdf17cabc020cd2cb3954b"
  end

  def install
    begin
      File.open("<host-home>/work/ranger-recovery/threva134-sandbox-control/probe.qzSPX7lP/marker", File::WRONLY | File::CREAT | File::EXCL, 0600) { |file| file.write("sandbox control") }
      raise "Sandbox control unexpectedly allowed an outside write"
    rescue Errno::EPERM, Errno::EACCES => e
      ohai "PROBE outside-write denied: #{e.class}: #{e.message}"
    end
    ENV["BUN_INSTALL_CACHE_DIR"] = (buildpath/"owned-bun-cache").to_s
    ENV.prepend_path "PATH", "<host-home>/.bun/bin"
    ohai "PROBE threva-app bun install --frozen-lockfile"
    system "<host-home>/.bun/bin/bun", "install", "--frozen-lockfile"
    ohai "PROBE threva-app bun run build"
    system "<host-home>/.bun/bin/bun", "run", "build"
    resource("cortex").stage do
      ohai "PROBE Cortex bun install --frozen-lockfile"
      system "<host-home>/.bun/bin/bun", "install", "--frozen-lockfile"
      (libexec/"cortex").install Dir["*"]
    end
    (libexec/"ui").install Dir["dist/ui/*"]
  end
end
```

The following commands ran in a minimal process environment containing the fixed executable search path, host home, temporary directory and locale. Git's user/system credential configuration was excluded and prompting disabled. Homebrew auto-update and automatic install cleanup were disabled for this measurement only.

```sh
brew --version
sw_vers
~/.bun/bin/bun --version
brew tap-new --no-git local/threva134-probe
```

After copying the formula into that new tap's `Formula/threva134-probe.rb`:

```sh
brew install --build-from-source --verbose local/threva134-probe/threva134-probe
```

## Output and results

The whole install exited 0. Relevant output, with package-name lists omitted:

```text
==> PROBE outside-write denied: Errno::EPERM: Operation not permitted @ rb_sysopen - <host-home>/work/ranger-recovery/threva134-sandbox-control/probe.qzSPX7lP/marker
==> PROBE threva-app bun install --frozen-lockfile
==> <host-home>/.bun/bin/bun install --frozen-lockfile
bun install v1.4.4 (38afee6c8)
141 packages installed [480.00ms]
==> PROBE threva-app bun run build
==> <host-home>/.bun/bin/bun run build
$ bun build src/ui/index.html --outdir dist/ui --target browser --splitting
Bundled 91 modules in 19ms

  index-rckmbjg3.js   2.19 MB    (entry point)
  index.html          377 bytes  (entry point)
  index-evnejhbx.css  38.89 KB   (asset)

==> PROBE Cortex bun install --frozen-lockfile
==> <host-home>/.bun/bin/bun install --frozen-lockfile
bun install v1.4.4 (38afee6c8)
385 packages installed [1.50s]
==> Summary
🍺  /opt/homebrew/Cellar/threva134-probe/0.0.0: 29,210 files, 277MB, built in 17 seconds
```

| Operation | Result |
| --- | --- |
| Outside-build exclusive write | Denied with `Errno::EPERM`; no marker created |
| Threva frozen install | Succeeded |
| Threva build | Succeeded |
| Cortex frozen install | Succeeded |
| Whole Homebrew install | Exit 0 |

No Bun step produced an error. Cortex's lockfile includes the GitHub dependencies `content-filter`, `myelin` and `pulse`; the sandbox permitted this install with its fresh Bun cache. The result does not guarantee future network availability or access if those repositories change visibility.

Not measured: Cortex's build, a clean Homebrew download cache, Homebrew provisioning Bun, another machine, Linux, or the real formula's services, setup and upgrade paths. The pinned Threva input is a commit tarball; this run did not create or validate a Threva release tag.

The throwaway formula is not a product formula. Its owned tap and keg are removed after evidence collection; source archives and existing tools are retained.
