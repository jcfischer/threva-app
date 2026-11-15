# Does Homebrew's install sandbox allow `bun install` and `bun run build`?

Measured for node #134, which settles the open choice in node #7.

## Answer

Yes. A formula in a personal tap can run `bun install --frozen-lockfile` for Cortex and for threva-app, and `bun run build` for threva-app, during `brew install --build-from-source`. The sandbox did not block the network, the lockfile installs or the GitHub-hosted git dependencies. The formula build can therefore install from source tarballs and does not need the prebuilt release asset fallback.

## Environment

| Item | Value |
| --- | --- |
| Homebrew | 7.0.13 |
| macOS | 27.2.1 (build 26B131), Apple Silicon (`/opt/homebrew`) |
| Bun | 1.4.4, installed by Homebrew as a `depends_on "bun" => :build` dependency (not the user's own `~/.bun`) |
| Cortex | tag `v6.30.0` tarball, sha256 `887075c2e94275485a581204ee47e774cb430aacfbbdf17cabc020cd2cb3954b` |
| threva-app | commit `70a904c` tarball (the repository has no tags yet), sha256 `de40566b43501d3c9fb837166fc72bf1917c10baf62af81e536c5205f7c1e43b` |

## Method

A throwaway local tap (`brew tap-new --no-git local/threva-probe`) held one formula. The threva-app tarball was the formula's `url`, and the Cortex tarball was a `resource`. `install` ran, in this order:

```ruby
depends_on "bun" => :build

resource "cortex" do
  url "https://github.com/the-metafactory/cortex/archive/refs/tags/v6.30.0.tar.gz"
  sha256 "887075c2e94275485a581204ee47e774cb430aacfbbdf17cabc020cd2cb3954b"
end

def install
  system "bun", "install", "--frozen-lockfile"
  system "bun", "run", "build"
  resource("cortex").stage do
    system "bun", "install", "--frozen-lockfile"
    (libexec/"cortex").install Dir["*"]
  end
  (libexec/"ui").install Dir["dist/ui/*"]
end
```

Command: `brew install --build-from-source --verbose local/threva-probe/threva-probe`.

## Results

| Step | Result |
| --- | --- |
| threva-app `bun install --frozen-lockfile` | Succeeded, exit 0 |
| threva-app `bun run build` | Succeeded, exit 0 |
| Cortex `bun install --frozen-lockfile` | Succeeded, exit 0 (385 packages, 1.64 s) |
| Whole `brew install` | Succeeded: `/opt/homebrew/Cellar/threva-probe/0.0.0: 29,210 files, 277MB, built in 18 seconds` |

No step produced an error, so there is no error text to record.

Output, trimmed:

```text
==> PROBE threva-app: bun install --frozen-lockfile
bun install v1.4.4 (5d9cc0f4f)
+ @antithesishq/bombadil@0.7.10
+ eslint@10.12.0
+ happy-dom@21.0.4
+ playwright-core@1.58.2
+ typescript@5.9.3
...
==> PROBE threva-app: bun run build
$ bun build src/ui/index.html --outdir dist/ui --target browser --splitting
Bundled 91 modules in 22ms

  index-rckmbjg3.js   2.19 MB    (entry point)
  index.html          377 bytes  (entry point)
  index-evnejhbx.css  38.89 KB   (asset)

==> PROBE cortex: bun install --frozen-lockfile
bun install v1.4.4 (5d9cc0f4f)
+ @metafactory/content-filter@github:the-metafactory/metafactory-bundle-content-filter#6d287ff
+ @the-metafactory/myelin@github:the-metafactory/myelin#b828b92
+ pulse@github:the-metafactory/pulse#9257027
+ hono@4.12.10
+ nats@2.29.3
...
385 packages installed [1.64s]
==> Summary
🍺  /opt/homebrew/Cellar/threva-probe/0.0.0: 29,210 files, 277MB, built in 18 seconds
```

## The sandbox was active

A second run (`brew reinstall --build-from-source`) added a write outside the build directory at the start of `install`. Homebrew's sandbox denied it, and the three Bun steps still passed:

```text
==> PROBE write outside: DENIED (Errno::EPERM: Operation not permitted @ rb_sysopen - /Users/Shared/threva-brew-probe.txt)
```

So the sandbox was in force when the installs ran. It restricts writes outside the build tree and allows network access, and Bun writes only inside the staged source directory and its cache.

## Consequences for the real formula

- Use the source path. Drop the prebuilt-asset fallback from the formula plan unless a later measurement shows a failure.
- Cortex's lockfile pulls three dependencies from GitHub (`content-filter`, `myelin`, `pulse`), so the install needs github.com at build time. If one of those repositories becomes private, `brew install` fails for every user.
- threva-app has no tag yet. The real formula needs a tag and a tarball checksum for it.
- Not measured: `bun run build` for Cortex (Cortex ships source), a Linux sandbox, and an install from a clean Bun cache on a second machine.

## Cleanup

The probe formula, its tap, the installed keg and the Homebrew Bun that the probe pulled in were removed afterwards. The tap is not committed.
