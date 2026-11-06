# Changelog

## [3.1.0] - 2026-11-06

### Added

- Add `vswitch servers [id]` to list the servers attached to every vSwitch, or
  to one vSwitch, with server names and a cancelled marker. Add
  `listVSwitchesWithServers()` and `addVSwitchServerNames()` to the library.

### Changed

- Replace `puppeteer-real-browser` with `chrome-launcher` and `playwright-core`
  for `cloud context bootstrap`. Automation now attaches only after you log in,
  and Cloudflare Turnstile checks are no longer clicked automatically; complete
  any check yourself in the browser.

### Security

- Remove the dependency chain behind the high-severity audit findings that
  affected npm installs.

## [3.0.0] - 2026-11-06

First release under the `@rollupdate/hctl` name. The previous package name was
`@ytspar/hctl`.

### Breaking

- Require Node.js `^20.17.0 || ^22.13.0 || >=23.5.0`; Node 18 is no longer
  supported.
- Remove `--datacenter` from `cloud server create` and
  `cloud primary-ip create`, because the Hetzner Cloud API no longer accepts it.
  Use `--location` instead.
- Remove `datacenter` from the `createServer` and `createPrimaryIp` library
  options, and replace `PrimaryIp.datacenter` with `location`.
- `listVSwitches`, `getVSwitch` and `createVSwitch` now return flat objects that
  match the Robot API. `updateVSwitch` and `addServerToVSwitch` return `void`.
- `vswitch list` no longer shows Servers and Subnets columns, because the list
  endpoint does not return them. Use `vswitch get <id>`.
- `-u`, `-p`, `--token` and `--json` now take effect, so `-u`/`-p` override
  stored credentials instead of being ignored.

### Added

- Add `--location` to `cloud primary-ip create`.

### Fixed

- Fix crashes in `vswitch list`, `vswitch get` and `vswitch create`.
- Fix crashes in `cloud primary-ip list` and `describe` after Hetzner removed
  the `datacenter` field.
- Make `--json` work on all Robot, Cloud and auction commands, and keep status
  messages off stdout in JSON mode.

## [2.5.0] - 2026-05-06

### Added

- Add a Cloudflare Worker auction cache that refreshes EUR and USD server
  auction JSON into R2 every 15 minutes, with timestamped historical snapshots.
- Add hosted-cache auction fetching by default, with `--direct` and
  `{ source: "direct" }` bypass options.
- Add `hctl auction status` for human and JSON freshness checks before
  automation.
- Add local auction cache fallback for `auction list` and `auction show` when
  the user's internet connection is unavailable.
- Add `hctl init` (alias `hctl setup`) — interactive first-time setup wizard
  that walks through Robot and Cloud credential creation, with explicit links
  to the Hetzner pages where each credential is generated. Also surfaces the
  same Cloud-token guidance whenever `hctl cloud context create <name>`
  prompts for a token interactively.

### Changed

- Rename the package and CLI presentation to `hctl`; publish the npm package
  as `@ytspar/hctl` while keeping the legacy `hetzner` binary alias.
- Deploy the website to Cloudflare Pages instead of GitHub Pages.
- Tighten the Robot and Cloud token-prompt guidance with the precise UI paths
  for each credential type.

## [2.4.1] - 2026-05-01

### Fixed

- Suppress dotenv 17's `[dotenv@…] injecting env (0) from .env` banner that
  was leaking onto stdout for every command. The banner broke any consumer
  piping `hctl --json …` into `jq` (cryptic
  `jq: parse error: Invalid numeric literal at line 1, column 15`). Both
  `config()` calls now pass `{ quiet: true }` (`src/cli.ts`,
  `src/shared/config.ts`).

## [2.4.0] - 2026-03-14

### Fixed

- Fix `deleteSshKey` crash when Hetzner Robot API returns 200 with empty body (#2)
- Handle empty response bodies gracefully using `response.text()` + `JSON.parse()` instead of `response.json()`

### Changed

- Consolidate shared helpers: `output()`, `confirmAction()`, and `handleActionError()` into `src/shared/helpers.ts`
- Cloud commands now use shared `output()` and `confirmAction()` instead of duplicate `cloudOutput()` / `cloudConfirm()`
- Refactor `asyncAction()` to inline client creation (removes module-level singleton)
- Add `auctionAction()` wrapper and `buildFilters()` helper to reduce duplication in auction commands
- Split `registerCloudServerCommands` (~580 → ~179 lines) into 24 handler functions
- Split `registerLoadBalancerCommands` (~502 → ~133 lines) into 18 handler functions
- Move auction types to `src/auction/types.ts` (re-exported from `src/types.ts` for backward compatibility)

### Security

- Resolve 4 dev-only dependency vulnerabilities via `npm audit fix`

## [2.3.1] - 2025-03-13

### Changed

- Add website link to README

## [2.3.0] - 2025-03-13

### Added

- `--output-schema` flag for LLM-friendly type introspection
- Ultracite + Biome for linting and formatting

## [2.2.0] - 2025-03-12

### Added

- Interactive website with terminal demo
- OG image and social meta tags
- GitHub Pages deployment workflow
