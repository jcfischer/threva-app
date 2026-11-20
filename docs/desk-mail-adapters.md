# Desk mail adapters prerequisite

Node #185 supplies the release that node #146 named as the condition it could not reach on its own: a tagged release of `the-metafactory/cortex-desk-adapters` whose portable mail commands read a mail account file given by `--config <path>`. Before this release the repository had no tag and no release at all, so the Homebrew formula had nothing to pin.

The release is public: [cortex-desk-adapters v0.2.0](https://github.com/the-metafactory/cortex-desk-adapters/releases/tag/v0.2.0).

| Fact | Value |
| --- | --- |
| Tag | `v0.2.0` |
| Tag commit | `422969c93554567831732705ce392489f4752a4c` |
| Release published | 2026-11-17 19:57 UTC |
| Tarball | `https://github.com/the-metafactory/cortex-desk-adapters/archive/refs/tags/v0.2.0.tar.gz` |
| Tarball sha256 | `af398436505044b4b79a62bafb2570aee96d39f1cddfa29ee837c13c7c47f679` |
| Tarball size | 216,521 bytes |

The formula in `jcfischer/homebrew-threva` pins that tarball and its sha256 as a `resource` under `libexec`, per the ruling on "Threva installer: the Homebrew formula in jcfischer/homebrew-threva" (#137). Threva's own source pin stays a GitHub tag, so this file holds the sha256 the formula needs; nothing in Threva fetches the tarball at runtime.

## What the release ships

The portable mail reading command is `desk-imap`. The root `bin/desk-mail.ts` is a one-release re-export of the personal command in `personal/bin/desk-mail.ts`, which wraps the `email` CLI; it is not the command a bundle pins. The commands that take `--config <path>` are:

| Command | The Desk runs it as | Reads |
| --- | --- | --- |
| `desk-imap` | `mc.desk.sources` entry | unread mail, sent mail with `--sent`, junk, invitations |
| `desk-mail-move` | `mc.desk.mail.actions.move` (and `.trash` while a stack moves over) | one move or restore request on stdin |
| `desk-mail-trash` | `mc.desk.mail.actions.trash` (legacy) | one trash request on stdin |
| `desk-mail-draft` | `mc.desk.mail.actions.draft` | one draft request on stdin |
| `desk-mail-report` | `mc.desk.mail.report.command` | one phishing report request on stdin |
| `desk-mail-invite` | `mc.desk.mail.invitations.command` | one invitation reply request on stdin |
| `desk-mail-send` | a routine's `A_MAIL_SEND` action | one send request on stdin or `--request-file` |
| `desk-mail-dmarc` | `mc.desk.mail.dmarc.command` | one held DMARC report mail |

Every command falls back to `~/.config/email/config.json`, the personal `email` CLI's file, when `--config` is absent. So an installed Threva can point them at its own file without touching that CLI's config, and without the CLI itself.

`desk-imap --config` still reads the mail over IMAP and prints one `{ items }` object: each item carries `kind: "mail"`, the Message-ID as `id`, `from`, `subject`, `receivedAt`, `unread`, and optionally `firstParagraph`, `url`, `account`, `headers`, `links` and `invitation`. The source contract is `src/contract.ts` and `src/cortex-contract.ts` at the tag.

## The mail account file

The commands do not define a new format. They read the one the personal `email` CLI already uses, so a person can move an account between the two by copying it. At the tag the reader is `src/mail-config.ts`, `src/imap-account.ts` and `src/smtp.ts`.

```json
{
  "defaultAccount": "work",
  "accounts": {
    "work": {
      "from": { "name": "Ada Lovelace", "email": "ada@example.org" },
      "imap": {
        "enabled": true,
        "host": "imap.example.org",
        "port": 993,
        "tls": true,
        "auth": { "user": "ada@example.org", "pass": "keychain:threva-mail-work" }
      },
      "smtp": {
        "host": "smtp.example.org",
        "port": 465,
        "secure": true,
        "auth": { "user": "ada@example.org", "pass": "keychain:threva-mail-work" }
      }
    }
  }
}
```

Rules the released code enforces, in the order it enforces them:

- `accounts` is an object of account records. An account name is matched without regard to case, so `--account work` finds `work` or `Work`. A missing name is refused with `There is no <name> account in the mail config.`
- An unreadable or unparsable file, and a file without an `accounts` object, are refused with `The mail config could not be read.` and `There is no <name> account in the mail config.` respectively. The file is never created by a command.
- `imap.enabled` must be exactly `true`, else the account has no IMAP settings. `imap.host` is a non-empty string and `imap.port` is a JSON number. `imap.tls: true` connects with implicit TLS on that port. Without it, the action commands (`desk-mail-move`, `desk-mail-trash`, `desk-mail-draft`, `desk-mail-report`, `desk-mail-invite`, `desk-mail-dmarc`) require STARTTLS and refuse a server that does not offer it, while `desk-imap --config` upgrades only when the server offers STARTTLS and otherwise reads the mailbox without TLS. An account that setup writes for a normal IMAP server carries `tls: true`.
- `imap.auth.user` and `imap.auth.pass` are the login. A record that carries them only under `smtp.auth` uses those for IMAP too.
- `smtp.host` must be a host name or IPv4 address (`A-Za-z0-9.-`, at most 253 characters), `smtp.port` is a JSON number, and `smtp.secure: true` means implicit TLS (`smtps`); otherwise the submission requires STARTTLS.
- `from.email` must be one plain address. `from.name` is optional. `desk-mail-send` takes its recipient allowlist from the `from.email` of every account in the selected file, so that file, not the routine, decides who can be mailed.
- A password is `keychain:<service>`, `env:<VAR>`, or the value itself, exactly as the `email` CLI reads it. `keychain:` runs `security find-generic-password -s <service> -w`, so the secret stays out of the file.
- `defaultAccount` names the account a command uses when a request names none.

`--config` is exclusive with the flag route: `desk-imap --config <file> --host ... --user ...` is refused with `Use --config or --host and --user, not both.`, and `--config` without `--account` is refused with `desk-imap --config needs --account.`

## Verified

Checked on 2026-11-17 against the tag's sources, extracted with `git archive v0.2.0`, and run with Bun 1.4.4:

- `gh api repos/the-metafactory/cortex-desk-adapters/tags` returns `v0.2.0` at `422969c9`; `.../releases` returns the published release, not a draft. The tag archive hashes to `af398436505044b4b79a62bafb2570aee96d39f1cddfa29ee837c13c7c47f679`.
- `desk-imap --config <file> --account test` with an unreachable host in the file fails with `desk-imap: connect ECONNREFUSED 127.0.0.1:1`: the command read the host and port from the file, not from the CLI's default.
- The same command with `--account work` against the same file fails with `There is no work account in the mail config.`, so account lookup, not a silent fallback, is what fails.
- The same command with `--config` and `--host` fails with `Use --config or --host and --user, not both.`; with `--config` and no `--account` it fails with `desk-imap --config needs --account.`
- `desk-mail-move --config <file>` with a move request on stdin tries the file's server and fails with `The test mail server did not accept the connection.` after reading the account, so the action commands read the same file.
- The password forms were exercised through the reader: a `keychain:` value was passed to `security`, and an `env:` value was read from the environment. No real account was used.

## What `threva setup` writes (nodes #141 and #146)

`threva setup` writes the account to its own file, and passes that path as `--config` to every mail command in the stack:

- The file is `~/.config/threva/mail-accounts.json`, mode `0600`, and the secret appears in it only as `keychain:threva-mail-<name>`. The password reaches the macOS Keychain through `security -i` on standard input, so it is never in a file and never in a process argument.
- The stack points `mc.desk.sources` at `mail-<name>` running `desk-imap --config <file> --account <name> --sent` (`everySeconds: 300`, `timeoutSeconds: 60`).
- `mc.desk.mail.actions` runs `desk-mail-move --config <file>` for both `move` and `trash`, and `desk-mail-draft --config <file>` for `draft`. Cortex deletes through `move` when a stack sets it: [`moveMail`](https://github.com/the-metafactory/cortex/blob/v6.37.0/src/surface/mc/desk/mail-move.ts) in v6.37.0, the tag `package.json` pins, takes the command from `move` before `trash` and sends `{ "action": "move", "account": …, "messageId": …, "target": "trash" }`, the request `MailMoveCommandRequestSchema` defines in the Desk SDK's `mail-command-contract.ts`. `desk-mail-trash` stays a legacy command that only a stack without `move` uses, so Threva does not install it.
- `mc.desk.mail.invitations.command` runs `desk-mail-invite --config <file>`, and `mc.desk.mail.report` runs `desk-mail-report --config <file>` with the report address when the person enters one.
- Every argv carries the absolute path of the installed Bun and of the installed adapter.
- Before it writes anything, setup runs `desk-imap --config <file> --account <name> --limit 1` against a temporary copy of the account and shows the command's last stderr line when the login or the inbox read fails, which is one plain sentence for each refusal listed above. It then asks for the password again and writes nothing for that account until the account answers.

### Delete through the move command, checked against the pinned Cortex

Checked on 2026-11-20 in the installed Cortex source of `@the-metafactory/cortex` at `v6.37.0`, run with Bun 1.4.4: `bun run test src/surface/mc/__tests__/desk-mail-actions.test.ts -t "move command"` passed all seven tests. Its case *sends Delete and the legacy trash request through the move command once it is set* configures `mc.desk.mail.actions.move`, posts the card's `trash` action and asserts the runner received `{ action: "move", account: "work", messageId: …, target: "trash" }`, so a stack that sets `move` reads the same command for Archive, Spam and Delete. The neighbouring case covers the fallback: with no `move`, Delete goes to `mc.desk.mail.actions.trash` as `{ action: "trash" }`.
