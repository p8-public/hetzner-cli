// ============================================================================
// LLM-Optimized CLI Reference
// Outputs a structured, verbose plaintext document designed for easy parsing
// by language models (Claude, GPT, etc.) while remaining human-readable.
// ============================================================================

import { createRequire } from "node:module";

export type ReferenceSection = "robot" | "cloud" | "auction";

const require = createRequire(import.meta.url);
const { version: packageVersion } = require("../../package.json") as {
  version: string;
};

const createPreamble = (version: string) => `\
# HCTL — COMPLETE REFERENCE
# =================================
# Version: ${version}
# Binary: hctl
# Install: npm install -g @rollupdate/hctl
# Source: https://github.com/p8-public/hetzner-cli
#
# This CLI manages three Hetzner APIs:
#   1. Robot API — dedicated server management (requires Robot web service credentials)
#   2. Cloud API — cloud server/resource management (requires Cloud API token)
#   3. Auction API — public server auction browser (no authentication required)
#
# OUTPUT MODES:
#   All commands default to human-readable formatted tables.
#   Add --json to any command to get machine-readable JSON output.
#   Add --output-schema to print the TypeScript type of the --json output (no API call).
#   Example: hctl server list --json | jq '.[].server.server_ip'
#   Example: hctl server list --output-schema
#
# SECTIONS: Use "hctl reference --section robot|cloud|auction" to show only one section.
#
# FIRST-TIME SETUP:
#   hctl init     — interactive wizard for Robot + Cloud credentials
#                   (alias: hctl setup; shows links to where each credential is created)
#                   Robot credentials are created in Robot; Cloud tokens are created in Cloud Console.
`;

const AUTHENTICATION = `\
# ============================================================================
# AUTHENTICATION
# ============================================================================
#
# ROBOT API — Credential Resolution Order:
#   Created in Robot UI: https://robot.hetzner.com
#   These are web service credentials, not Cloud Console API tokens.
#   1. CLI flags:       --user <username> --password <password>
#   2. Environment:     HETZNER_ROBOT_USER and HETZNER_ROBOT_PASSWORD
#   3. System keychain: stored by "hctl auth login" (uses keytar)
#   4. Config file:     ~/.hctl/config.json
#   5. Interactive:     prompts for username/password at runtime
#
#   Password from stdin (keeps password out of shell history):
#     echo "$PASSWORD" | hctl server list -u myuser -p -
#
#   With 1Password:
#     op read "op://vault/item/password" | hctl server list -u $(op read "op://vault/item/user") -p -
#
# CLOUD API — Token Resolution Order:
#   Created in Cloud Console per project: https://console.hetzner.cloud
#   These are project-scoped API tokens, not Robot web service credentials.
#   1. CLI flag:        --token <token> (per command)
#   2. Environment:     HETZNER_CLOUD_TOKEN
#   3. Active context:  ~/.hctl/cloud-contexts.json (set via "hctl cloud context use <name>")
#
# AUCTION API — No authentication required.

# ============================================================================
# GLOBAL OPTIONS (apply to all commands)
# ============================================================================

hctl [command] [options]
  -u, --user <username>       Robot API username
  -p, --password <password>   Robot API password (use "-" to read from stdin)
  --json                      Output raw JSON instead of formatted tables
  --output-schema             Print TypeScript type for --json output and exit (no API call)
  -V, --version               Show version number
  -h, --help                  Show help for any command`;

const SECTION_ROBOT = `\
# ============================================================================
# ROBOT API COMMANDS — Dedicated Server Management
# ============================================================================
# All robot commands require Robot API credentials (see AUTHENTICATION above).
# Robot API docs: https://robot.hetzner.com/doc/webservice/en.html

# --- init: First-Time Setup Wizard ---
hctl init                               # Interactive wizard: configures Robot + Cloud credentials
hctl setup                              # Alias for init
                                        #   Shows the exact URLs where Robot and Cloud credentials are created.
                                        #   Skips an API if it is already configured.

# --- auth: Credential Management ---
hctl auth login                         # Interactive login, saves credentials
hctl auth logout                        # Clear saved credentials from keychain and config
hctl auth status                        # Show current auth status (which credential source is active)
hctl auth test                          # Test credentials against the API

# --- server: Dedicated Server Management ---
hctl server list                        # List all servers (alias: ls)
hctl server get <server>                # Get server details by ID or IP (alias: show)
hctl server rename <server> <name>      # Rename a server

# --- reset: Server Reset Operations ---
hctl reset options [server]             # Show available reset types for server(s)
hctl reset execute <servers...>         # Reset one or more servers (alias: run)
  -t, --type <type>                        #   Reset type: sw (software, default), hw (hardware), man (manual), power, power_long
  -i, --interactive                        #   Interactively select reset type per server
  -y, --yes                                #   Skip confirmation prompt

# --- boot: Boot Configuration ---
hctl boot status <server>               # Show all boot configuration (rescue, linux, vnc, windows, etc.)

# boot rescue: Rescue System
hctl boot rescue activate <server>      # Activate rescue system
  -o, --os <os>                            #   OS: linux (default), linuxold, vkvm
  -a, --arch <arch>                        #   Architecture: 64 (default), 32
  -k, --keys <fingerprints...>             #   SSH key fingerprints to authorize
hctl boot rescue deactivate <server>    # Deactivate rescue system
hctl boot rescue last <server>          # Show last rescue activation (including password if recent)

# boot linux: Linux Installation
hctl boot linux activate <server>       # Activate Linux installation
  -d, --dist <dist>                        #   Distribution name (required), e.g. "Debian-1210-bookworm-amd64-base"
  -a, --arch <arch>                        #   Architecture: 64 (default), 32
  -l, --lang <lang>                        #   Language: en (default)
  -k, --keys <fingerprints...>             #   SSH key fingerprints to authorize
hctl boot linux deactivate <server>     # Deactivate pending Linux installation
hctl boot linux options <server>        # Show available Linux distributions for this server

# --- ip: IP Address Management ---
hctl ip list                            # List all IP addresses (alias: ls)
hctl ip get <ip>                        # Get IP details (alias: show)
hctl ip update <ip>                     # Update IP traffic warning settings
  --warnings <enabled>                     #   Enable/disable warnings: true/false
  --hourly <mb>                            #   Hourly traffic warning threshold in MB
  --daily <mb>                             #   Daily traffic warning threshold in MB
  --monthly <gb>                           #   Monthly traffic warning threshold in GB

# ip mac: Separate MAC Addresses
hctl ip mac get <ip>                    # Get separate MAC address for IP
hctl ip mac generate <ip>               # Generate a new separate MAC address
hctl ip mac delete <ip>                 # Delete separate MAC address

# --- subnet: Subnet Management ---
hctl subnet list                        # List all subnets (alias: ls)
hctl subnet get <subnet>                # Get subnet details (alias: show)

# --- failover: Failover IP Management ---
hctl failover list                      # List all failover IPs (alias: ls)
hctl failover get <ip>                  # Get failover IP details (alias: show)
hctl failover switch <failover-ip> <target-server-ip>  # Switch failover routing
  -y, --yes                                #   Skip confirmation
hctl failover delete <ip>               # Delete failover IP routing
  -y, --yes                                #   Skip confirmation

# --- rdns: Reverse DNS Management ---
hctl rdns list                          # List all reverse DNS entries (alias: ls)
hctl rdns get <ip>                      # Get reverse DNS for IP (alias: show)
hctl rdns set <ip> <ptr>                # Create or update reverse DNS entry
hctl rdns delete <ip>                   # Delete reverse DNS entry

# --- key: SSH Key Management ---
hctl key list                           # List all SSH keys (alias: ls)
hctl key get <fingerprint>              # Get SSH key details (alias: show)
hctl key add <name>                     # Add new SSH key (prompts for key data if no flags)
  -f, --file <path>                        #   Path to public key file (e.g. ~/.ssh/id_rsa.pub)
  -d, --data <key>                         #   Public key data as string
hctl key rename <fingerprint> <name>    # Rename an SSH key
hctl key delete <fingerprint>           # Delete an SSH key (alias: rm)
  -y, --yes                                #   Skip confirmation

# --- firewall: Firewall Management ---
hctl firewall get <server>              # Get firewall configuration (alias: show)
hctl firewall enable <server>           # Enable firewall
hctl firewall disable <server>          # Disable firewall
hctl firewall delete <server>           # Delete all firewall rules
  -y, --yes                                #   Skip confirmation

# firewall template: Firewall Templates
hctl firewall template list             # List firewall templates (alias: ls)
hctl firewall template get <id>         # Get template details (alias: show)
hctl firewall template delete <id>      # Delete template (alias: rm)
  -y, --yes                                #   Skip confirmation

# --- vswitch: vSwitch Management ---
hctl vswitch list                       # List all vSwitches (alias: ls)
hctl vswitch get <id>                   # Get vSwitch details (alias: show)
hctl vswitch servers [id]               # List servers on all vSwitches, or one (one API request per vSwitch, plus one for names)
hctl vswitch create <name> <vlan>       # Create a new vSwitch
hctl vswitch update <id>                # Update vSwitch
  -n, --name <name>                        #   New name
  -v, --vlan <vlan>                        #   New VLAN ID
hctl vswitch delete <id>                # Delete vSwitch (alias: rm)
  -y, --yes                                #   Skip confirmation
  --date <date>                            #   Cancellation date (YYYY-MM-DD format)
hctl vswitch add-server <vswitch-id> <server>      # Add server to vSwitch
hctl vswitch remove-server <vswitch-id> <server>   # Remove server from vSwitch

# --- storagebox: Storage Box Management (alias: storage) ---
hctl storagebox list                    # List all storage boxes (alias: ls)
hctl storagebox get <id>                # Get storage box details (alias: show)
hctl storagebox update <id>             # Update storage box settings
  -n, --name <name>                        #   Storage box name
  --webdav <enabled>                       #   Enable/disable WebDAV: true/false
  --samba <enabled>                        #   Enable/disable Samba: true/false
  --ssh <enabled>                          #   Enable/disable SSH/SFTP: true/false
  --external <enabled>                     #   Enable/disable external reachability: true/false
  --zfs <enabled>                          #   Enable/disable ZFS: true/false
hctl storagebox reset-password <id>     # Reset storage box password

# storagebox snapshot: Snapshot Management
hctl storagebox snapshot list <box-id>              # List snapshots (alias: ls)
hctl storagebox snapshot create <box-id>            # Create a new snapshot
hctl storagebox snapshot delete <box-id> <name>     # Delete a snapshot (alias: rm)
  -y, --yes                                            #   Skip confirmation
hctl storagebox snapshot revert <box-id> <name>     # Revert to a snapshot
  -y, --yes                                            #   Skip confirmation

# storagebox subaccount: Subaccount Management
hctl storagebox subaccount list <box-id>                       # List subaccounts (alias: ls)
hctl storagebox subaccount create <box-id> <home-directory>    # Create subaccount
  --samba <enabled>                        #   Enable Samba: true/false
  --ssh <enabled>                          #   Enable SSH: true/false
  --webdav <enabled>                       #   Enable WebDAV: true/false
  --external <enabled>                     #   Enable external access: true/false
  --readonly <enabled>                     #   Read-only mode: true/false
  --comment <comment>                      #   Comment
hctl storagebox subaccount delete <box-id> <username>  # Delete subaccount (alias: rm)
  -y, --yes                                #   Skip confirmation

# --- traffic: Traffic Analytics ---
hctl traffic query                      # Query traffic data
  -i, --ip <ips...>                        #   IP addresses to query
  -s, --subnet <subnets...>                #   Subnets to query
  --from <date>                            #   Start date (YYYY-MM-DD)
  --to <date>                              #   End date (YYYY-MM-DD)
  -t, --type <type>                        #   Query type: day, month (default), year

# --- wol: Wake on LAN ---
hctl wol status <server>                # Check WoL status for server
hctl wol send <server>                  # Send Wake on LAN packet

# --- cancel: Server Cancellation ---
hctl cancel status <server>             # Get cancellation status
hctl cancel request <server>            # Request server cancellation
  --date <date>                            #   Cancellation date (YYYY-MM-DD)
  --reason <reasons...>                    #   Cancellation reasons
  -y, --yes                                #   Skip confirmation
hctl cancel revoke <server>             # Revoke pending cancellation

# --- order: Server Ordering ---
hctl order products                     # List available server products
hctl order market                       # List server market/auction products (authenticated API)
hctl order transactions                 # List order transactions
hctl order transaction <id>             # Get order transaction details

# --- interactive: Interactive Mode (alias: i) ---
hctl interactive                        # Launch menu-driven interface for common operations
hctl i                                  # Short alias

# --- Robot API Examples ---
# List all dedicated servers:
#   hctl server list
#
# Get server details as JSON:
#   hctl server get 123456 --json
#
# Hardware reset a server:
#   hctl reset execute 123456 -t hw -y
#
# Activate rescue mode with SSH key:
#   hctl boot rescue activate 123456 -k ab:cd:ef:12:34:56
#
# Switch failover IP:
#   hctl failover switch 1.2.3.4 5.6.7.8 -y
#
# Query monthly traffic:
#   hctl traffic query --ip 1.2.3.4 --from 2025-01-01 --to 2025-01-31`;

const SECTION_CLOUD = `\
# ============================================================================
# CLOUD API COMMANDS — hctl cloud <resource> <action>
# ============================================================================
# All cloud commands require a Cloud API token (see AUTHENTICATION above).
# Cloud API docs: https://docs.hetzner.cloud/

# --- cloud context: Context/Token Management ---
hctl cloud context create <name>        # Create a new cloud context (saves token)
  -t, --token <token>                      #   API token (prompts interactively if omitted)
  --no-verify                              #   Skip validation with api.hetzner.cloud
hctl cloud context test                 # Validate the resolved Cloud API token
  -t, --token <token>                      #   Validate this token instead of resolving one
hctl cloud context bootstrap <name>     # Explicit browser-assisted token creation
  --project <name>                         #   Cloud project name
  --create-project                         #   Guide through creating the project first
  --token-name <name>                      #   API token name to use in Hetzner Console
  --permission <permission>                #   read or read-write (default: read-write)
  --write-env [path]                       #   Also write HETZNER_CLOUD_TOKEN to .env or path
  --no-verify                              #   Skip validation with api.hetzner.cloud
hctl cloud context use <name>           # Switch to a cloud context (sets it as active)
hctl cloud context delete <name>        # Delete a cloud context (alias: rm)
hctl cloud context list                 # List all cloud contexts (alias: ls)
hctl cloud context active               # Show the currently active cloud context

# --- cloud server: Cloud Server Management ---
hctl cloud server list                  # List all cloud servers (alias: ls)
  -l, --label-selector <selector>          #   Filter by label (e.g. "env=prod")
  -n, --name <name>                        #   Filter by name
  -s, --sort <field>                       #   Sort by field (e.g. "name", "created")
  --status <status>                        #   Filter by status (e.g. "running", "off")
hctl cloud server describe <id>         # Show server details
hctl cloud server create                # Create a new server
  --name <name>                            #   Server name (REQUIRED)
  --type <type>                            #   Server type, e.g. cx22 (REQUIRED)
  --image <image>                          #   Image name or ID, e.g. ubuntu-22.04 (REQUIRED)
  --location <location>                    #   Location: fsn1, nbg1, hel1, ash, hil
  --ssh-key <keys...>                      #   SSH key IDs or names
  --user-data <data>                       #   Cloud-init user data
  --start-after-create                     #   Start server immediately (default: true)
  --no-start-after-create                  #   Create without starting
hctl cloud server delete <id>           # Delete a server
  -y, --yes                                #   Skip confirmation
hctl cloud server update <id>           # Update server
  --name <name>                            #   New server name
hctl cloud server poweron <id>          # Power on a server
hctl cloud server poweroff <id>         # Power off a server (hard power off)
hctl cloud server reboot <id>           # Soft reboot a server (ACPI)
hctl cloud server reset <id>            # Hard reset a server
hctl cloud server shutdown <id>         # Graceful shutdown (ACPI signal)
hctl cloud server rebuild <id>          # Rebuild server with new image
  --image <image>                          #   Image to rebuild with (REQUIRED)
hctl cloud server change-type <id>      # Change server type (resize)
  --type <type>                            #   New server type (REQUIRED)
  --upgrade-disk                           #   Also upgrade disk (irreversible)
hctl cloud server enable-rescue <id>    # Enable rescue mode
  --type <type>                            #   Rescue type: linux64 (default)
  --ssh-key <keys...>                      #   SSH key IDs
hctl cloud server disable-rescue <id>   # Disable rescue mode
hctl cloud server enable-backup <id>    # Enable automatic backups
hctl cloud server disable-backup <id>   # Disable automatic backups
hctl cloud server create-image <id>     # Create snapshot from server
  --description <desc>                     #   Image description
  --type <type>                            #   Image type: snapshot (default), backup
hctl cloud server attach-iso <id>       # Attach ISO to server
  --iso <iso>                              #   ISO name or ID (REQUIRED)
hctl cloud server detach-iso <id>       # Detach ISO from server
hctl cloud server reset-password <id>   # Reset root password
hctl cloud server set-rdns <id>         # Set reverse DNS
  --ip <ip>                                #   IP address (REQUIRED)
  --dns-ptr <ptr>                          #   DNS pointer record (REQUIRED)
hctl cloud server enable-protection <id>   # Enable protection
  --delete                                 #   Delete protection (default: true)
  --rebuild                                #   Rebuild protection (default: false)
hctl cloud server disable-protection <id>  # Disable all protection
hctl cloud server request-console <id>  # Get WebSocket VNC console URL + password
hctl cloud server attach-to-network <id>   # Attach to network
  --network <network>                      #   Network ID (REQUIRED)
  --ip <ip>                                #   IP address in network (optional)
hctl cloud server detach-from-network <id> # Detach from network
  --network <network>                      #   Network ID (REQUIRED)
hctl cloud server add-label <id> <label>     # Add label (format: key=value)
hctl cloud server remove-label <id> <key>    # Remove label by key

# --- cloud network: Network Management ---
hctl cloud network list                 # List all networks (alias: ls)
hctl cloud network describe <id>        # Show network details
hctl cloud network create               # Create a network
  --name <name>                            #   Network name (REQUIRED)
  --ip-range <cidr>                        #   IP range in CIDR notation (REQUIRED)
hctl cloud network delete <id>          # Delete a network
  -y, --yes                                #   Skip confirmation

# --- cloud firewall: Cloud Firewall Management ---
hctl cloud firewall list                # List all firewalls (alias: ls)
hctl cloud firewall describe <id>       # Show firewall details
hctl cloud firewall create              # Create a firewall
  --name <name>                            #   Firewall name (REQUIRED)
hctl cloud firewall delete <id>         # Delete a firewall
  -y, --yes                                #   Skip confirmation

# --- cloud floating-ip: Floating IP Management ---
hctl cloud floating-ip list             # List all floating IPs (alias: ls)
hctl cloud floating-ip describe <id>    # Show floating IP details
hctl cloud floating-ip create           # Create a floating IP
  --type <type>                            #   IP type: ipv4, ipv6 (REQUIRED)
  --home-location <location>               #   Home location (REQUIRED)
  --description <desc>                     #   Description
hctl cloud floating-ip delete <id>      # Delete a floating IP
  -y, --yes                                #   Skip confirmation

# --- cloud primary-ip: Primary IP Management ---
hctl cloud primary-ip list              # List all primary IPs (alias: ls)
hctl cloud primary-ip describe <id>     # Show primary IP details
hctl cloud primary-ip create            # Create a primary IP
  --type <type>                            #   IP type: ipv4, ipv6 (REQUIRED)
  --name <name>                            #   Name (REQUIRED)
  --location <location>                    #   Location, e.g. fsn1 (required unless --assignee-id is set)
  --assignee-id <id>                       #   Server to assign to
  --auto-delete                            #   Auto-delete with server
hctl cloud primary-ip delete <id>       # Delete a primary IP
  -y, --yes                                #   Skip confirmation

# --- cloud volume: Volume Management ---
hctl cloud volume list                  # List all volumes (alias: ls)
hctl cloud volume describe <id>         # Show volume details
hctl cloud volume create                # Create a volume
  --name <name>                            #   Volume name (REQUIRED)
  --size <gb>                              #   Size in GB (REQUIRED)
  --location <location>                    #   Location
  --server <id>                            #   Attach to server immediately
hctl cloud volume delete <id>           # Delete a volume
  -y, --yes                                #   Skip confirmation

# --- cloud load-balancer: Load Balancer Management ---
hctl cloud load-balancer list           # List all load balancers (alias: ls)
hctl cloud load-balancer describe <id>  # Show load balancer details
hctl cloud load-balancer create         # Create a load balancer
  --name <name>                            #   Load balancer name (REQUIRED)
  --type <type>                            #   Load balancer type (REQUIRED)
  --location <location>                    #   Location
hctl cloud load-balancer delete <id>    # Delete a load balancer
  -y, --yes                                #   Skip confirmation

# --- cloud image: Image Management ---
hctl cloud image list                   # List all images (alias: ls)
  -l, --label-selector <selector>          #   Filter by label
  -s, --sort <field>                       #   Sort by field
  --type <type>                            #   Filter: system, snapshot, backup, app
  --architecture <arch>                    #   Filter: x86, arm
  --status <status>                        #   Filter by status
hctl cloud image describe <id>          # Show image details
hctl cloud image update <id>            # Update image
  --description <desc>                     #   New description
  --type <type>                            #   New type
hctl cloud image delete <id>            # Delete an image
  -y, --yes                                #   Skip confirmation

# --- cloud ssh-key: Cloud SSH Key Management ---
hctl cloud ssh-key list                 # List all SSH keys (alias: ls)
hctl cloud ssh-key describe <id>        # Show SSH key details
hctl cloud ssh-key create               # Create an SSH key
  --name <name>                            #   Key name (REQUIRED)
  --public-key <key>                       #   Public key data (REQUIRED)
hctl cloud ssh-key delete <id>          # Delete an SSH key
  -y, --yes                                #   Skip confirmation

# --- cloud certificate: TLS Certificate Management ---
hctl cloud certificate list             # List all certificates (alias: ls)
hctl cloud certificate describe <id>    # Show certificate details
hctl cloud certificate create           # Create/upload a certificate
  --name <name>                            #   Certificate name (REQUIRED)
  --certificate <cert>                     #   PEM certificate data
  --private-key <key>                      #   PEM private key data
hctl cloud certificate delete <id>      # Delete a certificate
  -y, --yes                                #   Skip confirmation

# --- cloud placement-group: Placement Group Management ---
hctl cloud placement-group list         # List all placement groups (alias: ls)
hctl cloud placement-group describe <id>   # Show placement group details
hctl cloud placement-group create       # Create a placement group
  --name <name>                            #   Group name (REQUIRED)
  --type <type>                            #   Type: spread (REQUIRED)
hctl cloud placement-group delete <id>  # Delete a placement group
  -y, --yes                                #   Skip confirmation

# --- cloud datacenter: Datacenter Information (read-only) ---
hctl cloud datacenter list              # List all datacenters (alias: ls)
hctl cloud datacenter describe <id>     # Show datacenter details

# --- cloud location: Location Information (read-only) ---
hctl cloud location list                # List all locations (alias: ls)
hctl cloud location describe <id>       # Show location details

# --- cloud server-type: Server Type Information (read-only) ---
hctl cloud server-type list             # List all server types (alias: ls)
hctl cloud server-type describe <id>    # Show server type details

# --- cloud load-balancer-type: Load Balancer Type Information (read-only) ---
hctl cloud load-balancer-type list      # List all load balancer types (alias: ls)
hctl cloud load-balancer-type describe <id>  # Show load balancer type details

# --- cloud iso: ISO Image Information ---
hctl cloud iso list                     # List all ISO images (alias: ls)
  -n, --name <name>                        #   Filter by name
  -a, --architecture <arch>                #   Filter by architecture
hctl cloud iso describe <id>            # Show ISO details

# --- Cloud API Examples ---
# Set up cloud authentication:
#   hctl init
# Or create an additional named context:
#   hctl cloud context create production -t hcloud_xxxxx
#   hctl cloud context use production
#
# Create a cloud server:
#   hctl cloud server create --name web1 --type cx22 --image ubuntu-22.04 --location fsn1 --ssh-key my-key
#
# List cloud servers filtered by label:
#   hctl cloud server list -l "env=prod" --json
#
# Snapshot a server:
#   hctl cloud server create-image 12345 --description "before upgrade"
#
# Resize a server:
#   hctl cloud server change-type 12345 --type cx32`;

const SECTION_AUCTION = `\
# ============================================================================
# AUCTION COMMANDS — Public Server Auction Browser
# ============================================================================
# No authentication required. Data from hosted 15-minute cache by default:
#   https://auction.hctl.dev/live_data_sb_EUR.json
# Use --direct to fetch from Hetzner's public endpoint instead:
#   https://www.hetzner.com/_resources/app/data/app/live_data_sb_EUR.json
# Returns the current public auction inventory. All filtering and sorting is done client-side.
# Human output includes auction freshness timestamps. JSON output stays parseable on stdout.
# When offline, "auction list" and "auction show" can use the last local cache and mark it stale.
# "auction diff" and "auction watch" require current data and do not snapshot stale local fallback data.
# Use "hctl auction status --json" before automation when freshness matters.
#
# TYPICAL DATA RANGES (approximate, changes continuously):
#   Price:       35 - 450 EUR/month
#   Hourly:      0.04 - 0.72 EUR/hour
#   RAM:         32 - 1024 GB
#   Disk total:  240 - 230,000+ GB
#   Disk count:  1 - 16 drives
#   CPU models:  Intel (i7, Xeon) and AMD (Ryzen, EPYC)
#   Datacenters: FSN1-DC* (Falkenstein), HEL1-DC* (Helsinki), NBG1-DC* (Nuremberg)
#   Specials:    ECC, GPU, IPv4, iNIC (Intel NIC)

# --- auction list: List and Filter Auction Servers ---
hctl auction list                       # List all auction servers (alias: ls)

  # PRICE FILTERS:
  --min-price <n>                          #   Minimum monthly price (EUR/USD)
  --max-price <n>                          #   Maximum monthly price
  --max-hourly-price <n>                   #   Maximum hourly price
  --max-setup-price <n>                    #   Maximum setup fee
  --no-setup-fee                           #   Only servers with zero setup fee (shorthand for --max-setup-price 0)
  --fixed-price                            #   Only fixed-price servers (price won't change)
  --auction-only                           #   Only auction servers (price decreases over time)

  # HARDWARE FILTERS:
  --cpu <text>                             #   CPU model substring match, case-insensitive
                                           #     Examples: "Ryzen", "EPYC", "i7-6700", "Xeon"
  --min-cpu-count <n>                      #   Minimum CPU/socket count
  --max-cpu-count <n>                      #   Maximum CPU/socket count
  --min-ram <gb>                           #   Minimum RAM in GB
  --max-ram <gb>                           #   Maximum RAM in GB
  --ecc                                    #   Only ECC RAM servers

  # DISK FILTERS:
  --min-disk-size <gb>                     #   Minimum total disk capacity in GB (sum across all drives)
  --max-disk-size <gb>                     #   Maximum total disk capacity in GB
  --min-disk-count <n>                     #   Minimum number of physical drives
  --max-disk-count <n>                     #   Maximum number of physical drives
  --disk-type <type>                       #   Only servers with this disk type: nvme, sata, hdd
                                           #     Note: server may have OTHER types too; this checks presence

  # NETWORK FILTERS:
  --datacenter <text>                      #   Datacenter substring match, case-insensitive
                                           #     Examples: "FSN" (all Falkenstein), "HEL1-DC2" (specific), "NBG"
  --min-bandwidth <mbit>                   #   Minimum bandwidth in Mbit/s

  # FEATURE FILTERS:
  --gpu                                    #   Only GPU servers
  --inic                                   #   Only servers with Intel NIC
  --highio                                 #   Only high I/O servers
  --specials <text>                        #   Filter by any special feature, substring match
                                           #     Examples: "GPU", "ECC", "iNIC", "IPv4"

  # TEXT SEARCH:
  --search <text>                          #   Free-text search across server description lines
                                           #     Searches the description array (CPU, RAM, disk details, NIC info)

  # SORTING:
  --sort <field>                           #   Sort field (default: price). Choices:
                                           #     price        — monthly price
                                           #     hourly       — hourly price
                                           #     setup        — setup fee
                                           #     ram          — RAM size in GB
                                           #     disk         — total disk capacity (sum of all drives)
                                           #     disk_count   — number of physical drives
                                           #     cpu          — CPU model name (alphabetical)
                                           #     cpu_count    — number of CPU sockets
                                           #     datacenter   — datacenter name (alphabetical)
                                           #     bandwidth    — bandwidth in Mbit/s
                                           #     next_reduce  — minutes until next price reduction (auction servers only)
  --desc                                   #   Sort in descending order (default: ascending)

  # OUTPUT:
  --currency <currency>                    #   EUR (default) or USD
  --direct                                 #   Fetch directly from Hetzner instead of hosted cache
  --limit <n>                              #   Limit number of results shown
  --json                                   #   Output raw JSON array

# --- auction show: Show Auction Server Details ---
hctl auction show <id>                  # Show full details for a specific auction server
  --currency <currency>                    #   EUR (default) or USD
  --direct                                 #   Fetch directly from Hetzner instead of hosted cache
  --json                                   #   Output raw JSON object

# --- auction status: Show Auction Freshness and Cache State ---
hctl auction status                     # Show hosted/local cache freshness
  --currency <currency>                    #   EUR (default) or USD
  --direct                                 #   Check Hetzner direct instead of hosted cache
  --json                                   #   Output machine-readable freshness JSON
                                           #     Includes: updatedAt, ageSeconds, stale, source,
                                           #     serverCount, endpointUrl, localCache, usingLocalFallback

# --- Auction API Examples ---
# Browse all auction servers sorted by price:
#   hctl auction list
#
# Find cheap AMD EPYC servers with NVMe and ECC in Helsinki:
#   hctl auction list --cpu epyc --disk-type nvme --ecc --datacenter HEL --sort price
#
# Find GPU servers under 150 EUR:
#   hctl auction list --gpu --max-price 150
#
# Find servers with at least 256 GB RAM and 4+ drives:
#   hctl auction list --min-ram 256 --min-disk-count 4 --sort ram --desc
#
# Find the cheapest fixed-price servers with NVMe:
#   hctl auction list --fixed-price --disk-type nvme --sort price --limit 10
#
# Find auction servers about to drop in price (sorted by nearest reduction):
#   hctl auction list --auction-only --sort next_reduce --limit 20
#
# Get full details for a specific auction server:
#   hctl auction show 2919866
#
# Export filtered results as JSON for scripting:
#   hctl auction list --max-price 60 --ecc --json | jq '.[].id'
#
# Check freshness before an agent relies on auction data:
#   hctl auction status --json
#
# Bypass the hosted cache:
#   hctl auction list --direct --max-price 60
#
# Compare EUR vs USD pricing:
#   hctl auction list --currency USD --max-price 50`;

const POSTAMBLE = `\
# ============================================================================
# CONFIGURATION FILES
# ============================================================================
# ~/.hctl/config.json           Robot API credentials (file-based fallback)
# ~/.hctl/cloud-contexts.json   Cloud API contexts and tokens
#
# System keychain (via keytar):        Robot API credentials (preferred, secure)
#   Service name: "hctl"
#   Account key:  "robot-api"
#
# Environment variables:
#   HETZNER_ROBOT_USER                 Robot API username
#   HETZNER_ROBOT_PASSWORD             Robot API password
#   HETZNER_CLOUD_TOKEN                Cloud API token (overrides context)
#   HCTL_AUCTION_SOURCE                Set to "direct" to bypass hosted auction cache
#   HCTL_AUCTION_CACHE_URL             Override hosted auction cache base URL

# ============================================================================
# PROGRAMMATIC (LIBRARY) USAGE
# ============================================================================
# This package can also be imported as a Node.js/TypeScript library:
#
#   import { HetznerRobotClient } from '@rollupdate/hctl';
#   import { fetchAuctionData, fetchAuctionServers, filterAuctionServers, sortAuctionServers } from '@rollupdate/hctl';
#
# Robot Client:
#   const client = new HetznerRobotClient(username, password);
#   const servers = await client.listServers();
#   const details = await client.getServer(123456);
#   await client.resetServer(123456, 'sw');
#
# Auction Client (no auth):
#   const { data, metadata } = await fetchAuctionData('EUR');
#   const { server: servers } = data;
#   console.log(metadata.updatedAt, metadata.ageSeconds, metadata.source);
#   const filtered = filterAuctionServers(servers, { maxPrice: 50, ecc: true });
#   const sorted = sortAuctionServers(filtered, 'price', false);`;

const SECTIONS: Record<ReferenceSection, string> = {
  robot: SECTION_ROBOT,
  cloud: SECTION_CLOUD,
  auction: SECTION_AUCTION,
};

export interface GenerateReferenceOptions {
  version?: string;
}

export function generateReference(
  section?: ReferenceSection,
  options: GenerateReferenceOptions = {}
): string {
  const preamble = `${createPreamble(options.version ?? packageVersion)}\n${AUTHENTICATION}`;

  if (section) {
    const body = SECTIONS[section];
    return `${preamble}\n\n${body}`;
  }
  return `${preamble}\n\n${SECTION_ROBOT}\n\n${SECTION_CLOUD}\n\n${SECTION_AUCTION}\n\n${POSTAMBLE}`;
}
