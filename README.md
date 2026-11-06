<p align="center">
  <img src="logo.svg" alt="hctl logo" width="128" height="128">
</p>

# hctl

[![npm version](https://badge.fury.io/js/%40rollupdate%2Fhctl.svg)](https://www.npmjs.com/package/@rollupdate/hctl)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**[Website](https://hctl.dev/)** · **[npm](https://www.npmjs.com/package/@rollupdate/hctl)** · **[GitHub](https://github.com/p8-public/hetzner-cli)**

Unified CLI and Node.js library for Hetzner's three APIs:

- **[Robot API](https://robot.hetzner.com)** — dedicated server management (servers, IPs, firewall, storage boxes, etc.)
- **[Cloud API](https://console.hetzner.cloud)** — cloud infrastructure (servers, networks, volumes, load balancers, etc.)
- **[Server Auction](https://www.hetzner.com/sb/)** — public server auction browser with rich filtering (no auth required)

> **Note:** This is an unofficial, community-built CLI. The official Hetzner Cloud CLI is [`hcloud`](https://github.com/hetznercloud/cli). See [how they differ](#comparison-with-official-cli).

---

## Table of Contents

- [Comparison with Official CLI](#comparison-with-official-cli)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Authentication](#authentication)
  - [Robot API Credentials](#robot-api-credentials)
  - [Cloud API Token](#cloud-api-token)
  - [Auction API](#auction-api-no-auth)
- [CLI Reference](#cli-reference)
  - [Global Options](#global-options)
  - [Robot Commands](#robot-commands)
  - [Cloud Commands](#cloud-commands)
  - [Auction Commands](#auction-commands)
  - [Built-in Reference](#built-in-reference)
- [Library Usage](#library-usage)
  - [Robot Client](#robot-client)
  - [Cloud Client](#cloud-client)
  - [Auction Client](#auction-client)
  - [Type Exports](#type-exports)
- [API Reference](#api-reference)
- [Configuration Files](#configuration-files)
- [Development](#development)
- [License](#license)

---

## Comparison with Official CLI

Hetzner maintains an official Cloud CLI called [`hcloud`](https://github.com/hetznercloud/cli), written in Go. This project (`hctl`) is a separate, community-built tool. Here's how they compare:

| Feature | [`hcloud`](https://github.com/hetznercloud/cli) (official) | `hctl` (this project) |
|---|---|---|
| **API coverage** | Cloud only | Cloud + Robot + Server Auction |
| **Language** | Go (single binary) | TypeScript / Node.js |
| **Install** | Homebrew, apt, binary download | `npm install -g @rollupdate/hctl` |
| **Library usage** | CLI only | Also usable as a Node.js library (`import { HetznerRobotClient } from '@rollupdate/hctl'`) |
| **Interactive mode** | No | Yes (`hctl interactive`) |
| **LLM reference** | No | Yes (`hctl reference` — structured output for LLM context) |

**When to use `hcloud`:** You only need Cloud API access and prefer a native binary with no runtime dependency.

**When to use `hctl`:** You manage dedicated servers (Robot), browse the server auction, or want a single tool that covers all three Hetzner APIs. Also useful if you need a Node.js library for automation scripts.

---

## Installation

```bash
# Global CLI
npm install -g @rollupdate/hctl

# Or as a project dependency
npm install @rollupdate/hctl
```

Requires Node.js 20.17+, 22.13+, or 23.5+.

---

## Quick Start

```bash
# First-time setup wizard for Robot + Cloud credentials
hctl init

# List your dedicated servers
hctl server list

# List your cloud servers
hctl cloud server list

# Browse the server auction (no login needed)
hctl auction list --max-price 60 --ecc --disk-type nvme --sort price
```

---

## Authentication

### Robot API Credentials

The Robot API uses a **web service username and password** (separate from your main Hetzner login).
These credentials are created in the Robot UI at [robot.hetzner.com](https://robot.hetzner.com), not in the Hetzner Cloud Console.

**To create credentials:**

1. Go to [robot.hetzner.com](https://robot.hetzner.com)
2. Navigate to **Settings > Web service settings**
3. Create a new web service user

**Credential resolution order** (first match wins):

| Priority | Method | Details |
|----------|--------|---------|
| 1 | CLI flags | `--user <username> --password <password>` |
| 2 | Environment variables | `HETZNER_ROBOT_USER` and `HETZNER_ROBOT_PASSWORD` |
| 3 | System keychain | Stored by `hctl auth login` (uses native keytar) |
| 4 | Config file | `~/.hctl/config.json` |
| 5 | Interactive prompt | Asks for username/password at runtime |

**Secure password passing** (keeps password out of shell history):

```bash
# From stdin
echo "$PASSWORD" | hctl server list -u myuser -p -

# With 1Password
op read "op://vault/item/password" | hctl server list -u $(op read "op://vault/item/user") -p -

# From environment
export HETZNER_ROBOT_USER=myuser
export HETZNER_ROBOT_PASSWORD=mypassword
hctl server list
```

### Cloud API Token

The Cloud API uses a **bearer token** from the Hetzner Cloud Console.
Cloud tokens are project-scoped and are created in the Cloud Console at [console.hetzner.cloud](https://console.hetzner.cloud), not in the Robot UI.

**To create a token:**

1. Go to [console.hetzner.cloud](https://console.hetzner.cloud)
2. Select your project, or create one
3. In the left menu, open **Security**
4. In the top menu, open **API Tokens**
5. Click **Generate API Token**
6. Name the token, for example `hctl`
7. Choose **Read & Write** for full `hctl` management, or **Read** for list/describe-only usage
8. Copy the token immediately; Hetzner only shows it once

**Token resolution order:**

| Priority | Method | Details |
|----------|--------|---------|
| 1 | CLI flag | `--token <token>` per command |
| 2 | Environment variable | `HETZNER_CLOUD_TOKEN` |
| 3 | Active context | Set via `hctl cloud context use <name>` |

```bash
# Interactive Robot + Cloud setup
hctl init

# Set up a named context (saves token)
hctl cloud context create production -t hcloud_xxxxxx

# Verify the resolved token before provisioning
hctl cloud context test

# Explicit browser-assisted token setup
hctl cloud context bootstrap placeswhere \
  --project Placeswhere \
  --create-project

# Switch contexts
hctl cloud context use production

# Or use inline
hctl cloud server list --token hcloud_xxxxxx
```

### Auction API (No Auth)

The auction commands use the hosted 15-minute Cloudflare cache by default. No credentials required, and normal CLI usage does not hit Hetzner's public JSON endpoint directly.

```bash
hctl auction list
hctl auction list --direct  # bypass the hosted cache and fetch from Hetzner
```

Hosted JSON files:

- `https://auction.hctl.dev/live_data_sb_EUR.json`
- `https://auction.hctl.dev/live_data_sb_USD.json`
- `https://auction.hctl.dev/metadata.json`
- `https://auction.hctl.dev/health.json`

If Hetzner's public JSON endpoint is temporarily unavailable, the Cloudflare Worker keeps serving the last good R2 snapshot and records the refresh failure in `metadata.json` and `health.json`. If the cache is empty and Hetzner cannot be reached, the Worker returns `502` with `Retry-After: 300`.

The CLI also keeps a local copy of the most recent successful auction response. If your internet connection is unavailable, `hctl auction list` and `hctl auction show` fall back to that local data and mark it as stale. JSON output remains valid JSON on stdout; stale-cache warnings are written to stderr.

`hctl auction status --json` is the stable machine-readable way to check freshness before automation. `auction diff` and `auction watch` require a current fetch and will not create change snapshots from stale local fallback data.

The Worker stores the current public files in R2 under `latest/` and keeps timestamped copies under `history/YYYY/MM/DD/HHmm/`. Those historical JSON snapshots are intended for later trend analysis in DuckDB or a database.

---

## CLI Reference

### Global Options

```
-u, --user <username>       Robot API username
-p, --password <password>   Robot API password (use "-" to read from stdin)
--json                      Output raw JSON instead of formatted tables
--output-schema             Print TypeScript type for --json output and exit
-V, --version               Show version number
-h, --help                  Show help for any command
```

All commands support `--json` for machine-readable output. Pipe to `jq` for filtering:

```bash
hctl server list --json | jq '.[].server.server_ip'
hctl auction list --max-price 50 --json | jq '.[].id'
```

### Robot Commands

Commands for managing Hetzner dedicated servers via the Robot API.

#### Authentication

```bash
hctl auth login           # Interactive credential setup
hctl auth logout          # Clear saved credentials
hctl auth status          # Show current auth source
hctl auth test            # Verify credentials work
```

#### Servers

```bash
hctl server list                       # List all servers
hctl server get <server>               # Server details (by ID or IP)
hctl server rename <server> <name>     # Rename a server
```

#### Reset

```bash
hctl reset options [server]            # Show available reset types
hctl reset execute <servers...>        # Reset servers
  -t, --type <type>                       #   sw|hw|man|power|power_long (default: sw)
  -i, --interactive                       #   Select type interactively
  -y, --yes                               #   Skip confirmation
```

#### Boot Configuration

```bash
hctl boot status <server>              # Show all boot config

# Rescue system
hctl boot rescue activate <server> [-o linux|linuxold|vkvm] [-a 64|32] [-k <fingerprints...>]
hctl boot rescue deactivate <server>
hctl boot rescue last <server>         # Show last rescue (includes password)

# Linux installation
hctl boot linux options <server>       # Show available distributions
hctl boot linux activate <server> -d <dist> [-a 64|32] [-l en] [-k <fingerprints...>]
hctl boot linux deactivate <server>
```

#### IP & Networking

```bash
hctl ip list                           # List all IPs
hctl ip get <ip>                       # IP details
hctl ip update <ip> [--warnings true|false] [--hourly <mb>] [--daily <mb>] [--monthly <gb>]
hctl ip mac get|generate|delete <ip>   # Separate MAC management

hctl subnet list                       # List subnets
hctl subnet get <subnet>

hctl failover list                     # List failover IPs
hctl failover get <ip>
hctl failover switch <failover-ip> <target-server-ip> [-y]
hctl failover delete <ip> [-y]

hctl rdns list                         # List reverse DNS entries
hctl rdns get <ip>
hctl rdns set <ip> <ptr>               # Create/update
hctl rdns delete <ip>
```

#### SSH Keys

```bash
hctl key list                          # List all keys
hctl key get <fingerprint>
hctl key add <name> [-f <path>] [-d <data>]
hctl key rename <fingerprint> <name>
hctl key delete <fingerprint> [-y]
```

#### Firewall

```bash
hctl firewall get <server>             # Show config
hctl firewall enable|disable <server>
hctl firewall delete <server> [-y]     # Delete all rules

hctl firewall template list
hctl firewall template get|delete <id>
```

#### vSwitch

```bash
hctl vswitch list
hctl vswitch get <id>
hctl vswitch servers [id]
hctl vswitch create <name> <vlan>
hctl vswitch update <id> [-n <name>] [-v <vlan>]
hctl vswitch delete <id> [-y] [--date <YYYY-MM-DD>]
hctl vswitch add-server <vswitch-id> <server>
hctl vswitch remove-server <vswitch-id> <server>
```

#### Storage Box

```bash
hctl storagebox list                   # (alias: storage)
hctl storagebox get <id>
hctl storagebox update <id> [-n <name>] [--webdav|--samba|--ssh|--external|--zfs true|false]
hctl storagebox reset-password <id>

# Snapshots
hctl storagebox snapshot list|create|delete|revert <box-id> [<name>]

# Subaccounts
hctl storagebox subaccount list <box-id>
hctl storagebox subaccount create <box-id> <home-directory> [--samba|--ssh|--webdav|--external|--readonly true|false]
hctl storagebox subaccount delete <box-id> <username> [-y]
```

#### Traffic, WoL, Cancellation, Ordering

```bash
hctl traffic query [-i <ips...>] [-s <subnets...>] [--from <date>] [--to <date>] [-t day|month|year]
hctl wol status|send <server>
hctl cancel status|request|revoke <server>
hctl order products|market|transactions
hctl order transaction <id>
```

#### Interactive Mode

```bash
hctl interactive   # or: hctl i
```

Menu-driven interface for common operations (list servers, reset, rescue, failover, SSH keys).

### Cloud Commands

All cloud commands live under `hctl cloud <resource> <action>`. Add `--token <token>` to any command to override the active context.

#### Context Management

```bash
hctl cloud context create <name> [-t <token>] [--no-verify]
hctl cloud context test [-t <token>]
hctl cloud context bootstrap <name> --project <name> [--create-project] [--write-env [path]]
hctl cloud context use <name>
hctl cloud context delete <name>
hctl cloud context list
hctl cloud context active
```

`hctl cloud context bootstrap` is an explicit opt-in assisted browser flow. It
opens a visible local real-browser session so you can log in to the Hetzner Cloud
Console yourself, including 2FA. `hctl` attaches to the browser only after you
press Enter, so no automation runs during login. It does not ask for or store
your console password and does not scrape the one-time API token from the page.
After Hetzner
prepares the token form, `hctl` asks for confirmation again before generating
the credential. Copy the resulting token yourself and paste it into the hidden
CLI prompt. The token is then validated and saved as a normal `hctl` cloud
context. Use `--write-env` only when you also want `HETZNER_CLOUD_TOKEN` written
to a local env file.

#### Cloud Servers

```bash
hctl cloud server list [-l <label-selector>] [-n <name>] [-s <sort>] [--status <status>]
hctl cloud server describe <id>
hctl cloud server create --name <name> --type <type> --image <image> [--location <loc>] [--ssh-key <keys...>]
hctl cloud server delete <id> [-y]
hctl cloud server update <id> [--name <name>]

# Power management
hctl cloud server poweron|poweroff|reboot|reset|shutdown <id>

# Maintenance
hctl cloud server rebuild <id> --image <image>
hctl cloud server change-type <id> --type <type> [--upgrade-disk]
hctl cloud server enable-rescue <id> [--type linux64] [--ssh-key <ids...>]
hctl cloud server disable-rescue <id>
hctl cloud server enable-backup|disable-backup <id>
hctl cloud server create-image <id> [--description <desc>]
hctl cloud server attach-iso|detach-iso <id> [--iso <iso>]
hctl cloud server reset-password <id>

# Networking
hctl cloud server set-rdns <id> --ip <ip> --dns-ptr <ptr>
hctl cloud server attach-to-network <id> --network <id> [--ip <ip>]
hctl cloud server detach-from-network <id> --network <id>

# Protection & labels
hctl cloud server enable-protection|disable-protection <id>
hctl cloud server add-label <id> <key=value>
hctl cloud server remove-label <id> <key>
hctl cloud server request-console <id>
```

#### Other Cloud Resources

Each follows the pattern: `hctl cloud <resource> list|describe|create|delete`

```bash
hctl cloud network list|describe|create|delete
hctl cloud firewall list|describe|create|delete
hctl cloud floating-ip list|describe|create|delete
hctl cloud primary-ip list|describe|create|delete
hctl cloud volume list|describe|create|delete
hctl cloud load-balancer list|describe|create|delete
hctl cloud image list|describe|update|delete
hctl cloud ssh-key list|describe|create|delete
hctl cloud certificate list|describe|create|delete
hctl cloud placement-group list|describe|create|delete

# Read-only reference data
hctl cloud datacenter list|describe
hctl cloud location list|describe
hctl cloud server-type list|describe
hctl cloud load-balancer-type list|describe
hctl cloud iso list|describe
```

### Auction Commands

Browse Hetzner's server auction — no authentication required. Data is fetched from the hosted 15-minute cache and filtered/sorted client-side. Add `--direct` when you want to bypass the cache and fetch directly from Hetzner.

```bash
hctl auction list [options]    # List and filter auction servers
hctl auction show <id>         # Detailed view of a single server
hctl auction status            # Show hosted/local cache freshness
hctl auction diff              # Compare current data with the last local snapshot
hctl auction watch             # Poll for local snapshot changes
```

#### Auction List — Full Option Reference

**Price filters:**

```bash
--min-price <n>          # Minimum monthly price
--max-price <n>          # Maximum monthly price
--max-hourly-price <n>   # Maximum hourly price
--max-setup-price <n>    # Maximum setup fee
--no-setup-fee           # Only free setup (shorthand for --max-setup-price 0)
--fixed-price            # Only fixed-price servers
--auction-only           # Only auction servers (price decreases over time)
```

**Hardware filters:**

```bash
--cpu <text>             # CPU model substring, case-insensitive (e.g. "Ryzen", "EPYC", "i7-6700")
--min-cpu-count <n>      # Minimum CPU/socket count
--max-cpu-count <n>      # Maximum CPU/socket count
--min-ram <gb>           # Minimum RAM in GB
--max-ram <gb>           # Maximum RAM in GB
--ecc                    # Only ECC RAM servers
```

**Disk filters:**

```bash
--min-disk-size <gb>     # Minimum total disk capacity (sum of all drives)
--max-disk-size <gb>     # Maximum total disk capacity
--min-disk-count <n>     # Minimum number of physical drives
--max-disk-count <n>     # Maximum number of physical drives
--disk-type <type>       # Must have this disk type: nvme, sata, hdd
```

**Network & feature filters:**

```bash
--datacenter <text>      # Datacenter substring, case-insensitive (e.g. "FSN", "HEL1-DC2", "NBG")
--min-bandwidth <mbit>   # Minimum bandwidth in Mbit/s
--gpu                    # Only GPU servers
--inic                   # Only Intel NIC servers
--highio                 # Only high I/O servers
--specials <text>        # Any special feature, substring match (e.g. "GPU", "ECC")
--search <text>          # Free-text search across description
```

**Sorting:**

```bash
--sort <field>           # Sort field (default: price). Choices:
                         #   price, hourly, setup, ram, disk, disk_count,
                         #   cpu, cpu_count, datacenter, bandwidth, next_reduce
--desc                   # Sort descending (default: ascending)
```

**Output:**

```bash
--currency <EUR|USD>     # Price currency (default: EUR)
--direct                 # Fetch directly from Hetzner instead of hosted cache
--limit <n>              # Limit number of results
--json                   # Output raw JSON
```

#### Auction Status

```bash
hctl auction status
hctl auction status --json
hctl auction status --currency USD
```

`auction status --json` is the recommended freshness check for scripts and LLM agents. It includes `updatedAt`, `ageSeconds`, `stale`, `source`, `serverCount`, `endpointUrl`, `usingLocalFallback`, and local cache state.

#### Auction Examples

```bash
# Browse all servers, cheapest first
hctl auction list

# Cheap AMD EPYC with NVMe + ECC in Helsinki
hctl auction list --cpu epyc --disk-type nvme --ecc --datacenter HEL --sort price

# GPU servers under 150 EUR
hctl auction list --gpu --max-price 150

# High-RAM servers with lots of drives
hctl auction list --min-ram 256 --min-disk-count 4 --sort ram --desc

# Cheapest 10 fixed-price NVMe servers
hctl auction list --fixed-price --disk-type nvme --sort price --limit 10

# Auction servers about to drop in price
hctl auction list --auction-only --sort next_reduce --limit 20

# Export to JSON for scripting
hctl auction list --max-price 60 --ecc --json | jq '.[].id'

# Check freshness before automation
hctl auction status --json

# Bypass the hosted cache
hctl auction list --direct --max-price 60
```

### Built-in Reference

For a complete, structured reference optimized for LLM context windows:

```bash
hctl reference         # or: hctl ref
hctl reference --section auction
hctl auction status --output-schema
```

This prints every command, option, and example in a structured plaintext format designed for easy parsing by language models. Pipe it into your LLM context:

```bash
hctl reference | pbcopy                    # Copy to clipboard (macOS)
hctl reference > /tmp/hctl-ref.txt         # Save to file
```

---

## Library Usage

### Robot Client

```typescript
import { HetznerRobotClient } from '@rollupdate/hctl';

const client = new HetznerRobotClient('username', 'password');

// List servers
const servers = await client.listServers();

// Get server details
const { server } = await client.getServer(123456);
console.log(server.server_name, server.server_ip);

// Reset a server
await client.resetServer(123456, 'sw');

// Activate rescue mode
const rescue = await client.activateRescue(123456, 'linux', 64, ['ssh-fingerprint']);
console.log('Password:', rescue.rescue.password);

// Linux installation
await client.activateLinux(123456, 'Debian-1210-bookworm-amd64-base', 64, 'en', ['ssh-fingerprint']);

// Failover
await client.switchFailover('1.2.3.4', '5.6.7.8');

// SSH keys
const keys = await client.listSshKeys();
await client.createSshKey('my-key', 'ssh-rsa AAAA...');

// Storage box
const boxes = await client.listStorageBoxes();
await client.createStorageBoxSnapshot(123);

// Firewall
const fw = await client.getFirewall(123456);
await client.updateFirewall(123456, 'active');
```

### Cloud Client

```typescript
import { HetznerCloudClient } from '@rollupdate/hctl';

const client = new HetznerCloudClient('hcloud_xxxxxx');

// List servers
const { servers } = await client.listServers();

// Create a server
const result = await client.createServer({
  name: 'web1',
  server_type: 'cx22',
  image: 'ubuntu-22.04',
  location: 'fsn1',
});

// Networks
const { networks } = await client.listNetworks();
await client.createNetwork({ name: 'my-net', ip_range: '10.0.0.0/16' });

// Volumes
const { volumes } = await client.listVolumes();
await client.createVolume({ name: 'data', size: 50, location: 'fsn1' });

// Load Balancers
const { load_balancers } = await client.listLoadBalancers();

// Firewalls, Floating IPs, SSH Keys, Images, etc.
const { firewalls } = await client.listFirewalls();
const { floating_ips } = await client.listFloatingIps();
const { ssh_keys } = await client.listSshKeys();
```

### Auction Client

```typescript
import {
  fetchAuctionData,
  fetchAuctionServers,
  filterAuctionServers,
  getAuctionDataUrl,
  sortAuctionServers,
} from '@rollupdate/hctl';

// Fetch all servers from the hosted 15-minute cache (EUR pricing)
const { server: servers } = await fetchAuctionServers('EUR');
const { metadata } = await fetchAuctionData('EUR');
console.log(metadata.updatedAt, metadata.ageSeconds, metadata.source);

// Or bypass the cache and fetch directly from Hetzner
const live = await fetchAuctionServers('EUR', { source: 'direct' });

console.log(getAuctionDataUrl('EUR'), live.serverCount);

// Filter: cheap ECC NVMe servers in Helsinki
const filtered = filterAuctionServers(servers, {
  maxPrice: 60,
  ecc: true,
  diskType: 'nvme',
  datacenter: 'HEL',
});

// Sort by price ascending
const sorted = sortAuctionServers(filtered, 'price', false);

console.log(`Found ${sorted.length} servers`);
for (const s of sorted) {
  console.log(`${s.id}: ${s.cpu} | ${s.ram_size}GB | €${s.price}/mo | ${s.datacenter}`);
}
```

### Type Exports

```typescript
import type {
  // Robot types
  Server, ServerDetails, Reset, ResetType,
  RescueConfig, LinuxConfig,
  IP, Subnet, Failover, Rdns,
  SshKey, Firewall, FirewallRule,
  VSwitch, StorageBox,
  Traffic, Wol,
  ServerProduct, ServerMarketProduct,

  // Cloud types
  CloudServer, CloudAction, CloudFirewall, CloudFirewallRule,
  CloudSshKey, Network, NetworkSubnet, NetworkRoute,
  FloatingIp, PrimaryIp, Volume, Image,
  LoadBalancer, LoadBalancerType, LoadBalancerTarget, LoadBalancerService,
  Certificate, PlacementGroup, Datacenter, Location,
  ServerType, ISO, Labels,

  // Auction types
  AuctionServer, AuctionDiskData, AuctionIpPrice,
  AuctionFilterOptions, AuctionResponse,
} from '@rollupdate/hctl';
```

---

## API Reference

### HetznerRobotClient Methods

#### Servers

| Method | Description |
|--------|-------------|
| `listServers()` | List all servers |
| `getServer(id)` | Get server details |
| `updateServerName(id, name)` | Rename server |
| `getCancellation(id)` | Get cancellation status |
| `cancelServer(id, date?, reasons?)` | Cancel server |
| `revokeCancellation(id)` | Revoke cancellation |

#### Reset

| Method | Description |
|--------|-------------|
| `listResetOptions()` | List all reset options |
| `getResetOptions(id)` | Get reset options for server |
| `resetServer(id, type?)` | Reset server (sw/hw/man/power/power_long) |

#### Boot

| Method | Description |
|--------|-------------|
| `getBootConfig(id)` | Get all boot configs |
| `activateRescue(id, os, arch?, keys?)` | Activate rescue |
| `deactivateRescue(id)` | Deactivate rescue |
| `getLastRescue(id)` | Get last rescue activation |
| `getLinux(id)` | Get available Linux distributions |
| `activateLinux(id, dist, arch?, lang?, keys?)` | Activate Linux install |
| `deactivateLinux(id)` | Deactivate Linux |
| `activateVnc(id, dist, arch?, lang?)` | Activate VNC install |
| `activateWindows(id, dist, lang?)` | Activate Windows install |

#### IPs & Networking

| Method | Description |
|--------|-------------|
| `listIps()` | List all IPs |
| `getIp(ip)` | Get IP details |
| `updateIp(ip, warnings?, hourly?, daily?, monthly?)` | Update IP settings |
| `generateIpMac(ip)` | Generate separate MAC |
| `deleteIpMac(ip)` | Delete MAC |
| `listSubnets()` | List subnets |
| `getSubnet(ip)` | Get subnet details |
| `listFailovers()` | List failover IPs |
| `getFailover(ip)` | Get failover details |
| `switchFailover(ip, targetIp)` | Switch routing |
| `deleteFailoverRouting(ip)` | Delete routing |
| `listRdns()` | List reverse DNS |
| `getRdns(ip)` | Get rDNS for IP |
| `createRdns(ip, ptr)` | Create/update rDNS |
| `deleteRdns(ip)` | Delete rDNS |

#### SSH Keys

| Method | Description |
|--------|-------------|
| `listSshKeys()` | List SSH keys |
| `getSshKey(fingerprint)` | Get key details |
| `createSshKey(name, data)` | Add SSH key |
| `updateSshKey(fingerprint, name)` | Rename key |
| `deleteSshKey(fingerprint)` | Delete key |

#### Firewall

| Method | Description |
|--------|-------------|
| `getFirewall(id)` | Get firewall config |
| `updateFirewall(id, status, rules?)` | Update firewall |
| `deleteFirewall(id)` | Delete all rules |
| `listFirewallTemplates()` | List templates |
| `getFirewallTemplate(id)` | Get template |
| `deleteFirewallTemplate(id)` | Delete template |

#### vSwitch

| Method | Description |
|--------|-------------|
| `listVSwitches()` | List vSwitches |
| `getVSwitch(id)` | Get details |
| `listVSwitchesWithServers()` | Get details for every vSwitch, including servers |
| `addVSwitchServerNames(vswitches)` | Add server names to vSwitch details |
| `createVSwitch(name, vlan)` | Create |
| `updateVSwitch(id, name?, vlan?)` | Update |
| `deleteVSwitch(id, date?)` | Delete |
| `addServerToVSwitch(vswitchId, serverId)` | Add server |
| `removeServerFromVSwitch(vswitchId, serverId)` | Remove server |

#### Storage Box

| Method | Description |
|--------|-------------|
| `listStorageBoxes()` | List storage boxes |
| `getStorageBox(id)` | Get details |
| `updateStorageBox(id, ...)` | Update settings |
| `resetStorageBoxPassword(id)` | Reset password |
| `listStorageBoxSnapshots(id)` | List snapshots |
| `createStorageBoxSnapshot(id)` | Create snapshot |
| `deleteStorageBoxSnapshot(id, name)` | Delete snapshot |
| `revertStorageBoxSnapshot(id, name)` | Revert to snapshot |
| `listStorageBoxSubaccounts(id)` | List subaccounts |
| `createStorageBoxSubaccount(id, ...)` | Create subaccount |
| `deleteStorageBoxSubaccount(id, username)` | Delete subaccount |

#### Traffic, WoL, Ordering

| Method | Description |
|--------|-------------|
| `getTraffic(ips, subnets, from, to, type)` | Query traffic |
| `getWol(id)` | Get WoL status |
| `sendWol(id)` | Send Wake-on-LAN |
| `listServerProducts()` | List products |
| `listServerMarketProducts()` | List auction servers |
| `getServerTransaction(id)` | Get transaction |
| `listServerTransactions()` | List transactions |

### HetznerCloudClient Methods

#### Context Management

| Function | Description |
|----------|-------------|
| `createContext(name, token)` | Create a named context (stores token) |
| `useContext(name)` | Switch active context |
| `deleteContext(name)` | Delete a context |
| `listContexts()` | List all contexts |
| `getActiveContext()` | Get active context name |
| `resolveToken(opts)` | Resolve token (flag > env > context) |

#### Servers

| Method | Description |
|--------|-------------|
| `listServers(params?)` | List cloud servers |
| `getServer(id)` | Get server details |
| `createServer(data)` | Create a server |
| `deleteServer(id)` | Delete a server |
| `updateServer(id, data)` | Update server name/labels |
| `poweronServer(id)` | Power on |
| `poweroffServer(id)` | Hard power off |
| `rebootServer(id)` | Soft reboot |
| `resetServer(id)` | Hard reset |
| `shutdownServer(id)` | Graceful shutdown |
| `rebuildServer(id, image)` | Rebuild with image |
| `changeServerType(id, type, disk?)` | Resize server |
| `enableRescue(id, type?, keys?)` | Enable rescue mode |
| `disableRescue(id)` | Disable rescue mode |
| `enableBackup(id)` | Enable backups |
| `disableBackup(id)` | Disable backups |
| `createImage(id, desc?, type?)` | Create snapshot |
| `attachIso(id, iso)` | Attach ISO |
| `detachIso(id)` | Detach ISO |
| `resetPassword(id)` | Reset root password |
| `setRdns(id, ip, ptr)` | Set reverse DNS |
| `changeProtection(id, opts)` | Change protection |
| `requestConsole(id)` | Get VNC console URL |
| `attachToNetwork(id, network, ip?)` | Attach to network |
| `detachFromNetwork(id, network)` | Detach from network |

#### Networks

| Method | Description |
|--------|-------------|
| `listNetworks()` | List networks |
| `getNetwork(id)` | Get network details |
| `createNetwork(data)` | Create a network |
| `deleteNetwork(id)` | Delete a network |
| `addSubnet(id, subnet)` | Add subnet |
| `deleteSubnet(id, subnet)` | Delete subnet |
| `addRoute(id, route)` | Add route |
| `deleteRoute(id, route)` | Delete route |
| `changeIpRange(id, range)` | Change IP range |

#### Firewalls, IPs, Volumes, Load Balancers

| Method | Description |
|--------|-------------|
| `listFirewalls()` / `getFirewall(id)` / `createFirewall(data)` / `deleteFirewall(id)` | Firewall CRUD |
| `listFloatingIps()` / `getFloatingIp(id)` / `createFloatingIp(data)` / `deleteFloatingIp(id)` | Floating IP CRUD |
| `listPrimaryIps()` / `getPrimaryIp(id)` / `createPrimaryIp(data)` / `deletePrimaryIp(id)` | Primary IP CRUD |
| `listVolumes()` / `getVolume(id)` / `createVolume(data)` / `deleteVolume(id)` | Volume CRUD |
| `listLoadBalancers()` / `getLoadBalancer(id)` / `createLoadBalancer(data)` / `deleteLoadBalancer(id)` | Load Balancer CRUD |
| `listImages()` / `getImage(id)` / `updateImage(id, data)` / `deleteImage(id)` | Image management |
| `listSshKeys()` / `getSshKey(id)` / `createSshKey(data)` / `deleteSshKey(id)` | SSH key CRUD |
| `listCertificates()` / `getCertificate(id)` / `createCertificate(data)` / `deleteCertificate(id)` | Certificate CRUD |
| `listPlacementGroups()` / `getPlacementGroup(id)` / `createPlacementGroup(data)` / `deletePlacementGroup(id)` | Placement group CRUD |

#### Reference Data (Read-Only)

| Method | Description |
|--------|-------------|
| `listDatacenters()` / `getDatacenter(id)` | Datacenter info |
| `listLocations()` / `getLocation(id)` | Location info |
| `listServerTypes()` / `getServerType(id)` | Server type info |
| `listLoadBalancerTypes()` / `getLoadBalancerType(id)` | LB type info |
| `listIsos(params?)` / `getIso(id)` | ISO image info |

### Auction Functions

| Function | Description |
|----------|-------------|
| `fetchAuctionData(currency?, options?)` | Fetch servers plus freshness metadata (`updatedAt`, `ageSeconds`, `source`, `stale`, `url`) |
| `fetchAuctionServers(currency?, options?)` | Fetch all servers from hosted cache by default, or direct from Hetzner with `{ source: "direct" }` |
| `filterAuctionServers(servers, filters)` | Apply filter criteria to server array |
| `getAuctionDataUrl(currency?, options?)` | Resolve the JSON URL used for a cache or direct fetch |
| `sortAuctionServers(servers, field, desc)` | Sort servers by field |

---

## Configuration Files

| File | Purpose |
|------|---------|
| `~/.hctl/config.json` | Robot API credentials (file-based fallback) |
| `~/.hctl/cloud-contexts.json` | Cloud API contexts and tokens |

System keychain (via keytar):

| Key | Value |
|-----|-------|
| Service | `hctl` |
| Account | `robot-api` |

Environment variables:

| Variable | Purpose |
|----------|---------|
| `HETZNER_ROBOT_USER` | Robot API username |
| `HETZNER_ROBOT_PASSWORD` | Robot API password |
| `HETZNER_CLOUD_TOKEN` | Cloud API token (overrides active context) |
| `HCTL_AUCTION_SOURCE` | Set to `direct` to bypass the hosted auction cache |
| `HCTL_AUCTION_CACHE_URL` | Override the hosted auction cache base URL |

### Cloudflare Deployment

The website deploys to Cloudflare Pages via `.github/workflows/deploy-website.yml`. The auction cache deploys as a separate Cloudflare Worker via `.github/workflows/deploy-auction-worker.yml`; it refreshes EUR and USD auction JSON into R2 every 15 minutes with the Cron Trigger in `wrangler.auction.toml`.

The Worker validates that Hetzner returns JSON with a `server` array before updating R2. Refresh failures do not overwrite the last good snapshot; they are recorded under the metadata and health endpoints so monitors can detect degraded refreshes.

R2 object layout:

| Prefix | Purpose |
|--------|---------|
| `latest/live_data_sb_EUR.json` | Current EUR auction JSON |
| `latest/live_data_sb_USD.json` | Current USD auction JSON |
| `history/YYYY/MM/DD/HHmm/live_data_sb_EUR.json` | Historical EUR snapshots |
| `history/YYYY/MM/DD/HHmm/live_data_sb_USD.json` | Historical USD snapshots |
| `failures/EUR.json` | Last EUR refresh failure, when present |
| `failures/USD.json` | Last USD refresh failure, when present |

Required GitHub secret:

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Token with Pages, Workers, Workers KV, and Workers R2 edit access |

Optional GitHub variables:

| Variable | Default |
|----------|---------|
| `CLOUDFLARE_ACCOUNT_ID` | `fffa2cbba41f8b0e145472fe76c90065` |
| `CLOUDFLARE_PAGES_PROJECT_NAME` | `hctl` |
| `WEBSITE_ORIGIN` | `https://hctl.dev` |

Initial setup:

```bash
npx wrangler pages project create hctl --production-branch main
npx wrangler r2 bucket create hctl-auction-data
npx wrangler deploy --config wrangler.auction.toml
```

Manual deployments:

```bash
gh workflow run deploy-website.yml
gh workflow run deploy-auction-worker.yml
```

---

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm test             # Run tests
npm run test:coverage  # Run with coverage report
npm run test:watch   # Watch mode
```

### Project Structure

```
src/
├── cli.ts                     # CLI entry point
├── index.ts                   # Library exports
├── shared/
│   ├── config.ts              # Credential management
│   ├── formatter.ts           # Colors, tables, output formatting
│   ├── helpers.ts             # asyncAction, output, confirmAction
│   └── reference.ts           # Built-in reference documentation
├── robot/
│   ├── client.ts              # Robot API client (HetznerRobotClient)
│   ├── types.ts               # Robot type definitions
│   ├── formatter.ts           # Robot-specific formatters
│   └── commands/              # CLI command modules (17 files)
├── cloud/
│   ├── client.ts              # Cloud API client
│   ├── context.ts             # Context/token management
│   ├── types.ts               # Cloud type definitions
│   ├── formatter.ts           # Cloud-specific formatters
│   ├── helpers.ts             # Cloud action wrappers
│   └── commands/              # CLI command modules (17 files)
└── auction/
    ├── client.ts              # Auction fetch/filter/sort
    ├── formatter.ts           # Auction formatters
    └── commands.ts            # Auction CLI commands
```

### AI Agent Instructions

This repo is developed with help from multiple coding agents. Each reads its own instruction file at the repo root:

- **Claude Code** — `.claude/CLAUDE.md` (project-scoped instructions)
- **OpenAI Codex / generic agents** — `AGENTS.md`

Both files describe the same code-quality conventions (Ultracite + Biome), so agents produce consistent output regardless of which one is driving.

---

## License

MIT
