// ============================================================================
// Output Schema Registry
// Maps command paths → self-contained TypeScript type definitions describing
// the JSON output shape. Used by --output-schema to print type info without
// making any API calls.
// ============================================================================

// ---------------------------------------------------------------------------
// Robot API shared type blocks
// ---------------------------------------------------------------------------

const ROBOT_SERVER_SUBNET = `\
interface ServerSubnet {
  ip: string;
  mask: string;
}`;

const ROBOT_SERVER = `\
${ROBOT_SERVER_SUBNET}

interface Server {
  server_ip: string;
  server_ipv6_net: string;
  server_number: number;
  server_name: string;
  product: string;
  dc: string;
  traffic: string;
  status: 'ready' | 'installing' | 'maintenance';
  cancelled: boolean;
  paid_until: string;
  ip: string[];
  subnet: ServerSubnet[];
}`;

const ROBOT_SERVER_DETAILS = `\
${ROBOT_SERVER}

interface ServerDetails extends Server {
  reset: boolean;
  rescue: boolean;
  vnc: boolean;
  windows: boolean;
  plesk: boolean;
  cpanel: boolean;
  wol: boolean;
  hot_swap: boolean;
}`;

const ROBOT_RESET = `\
interface Reset {
  server_ip: string;
  server_ipv6_net: string;
  server_number: number;
  type: ('sw' | 'hw' | 'man' | 'power' | 'power_long')[];
  operating_status: string;
}`;

const ROBOT_BOOT_CONFIG = `\
interface BaseBootConfig {
  server_ip: string;
  server_ipv6_net: string;
  server_number: number;
  active: boolean;
  password: string | null;
}

interface RescueConfig extends BaseBootConfig {
  os: string[];
  arch: number[];
  authorized_key: string[];
  host_key: string[];
}

interface LinuxConfig extends BaseBootConfig {
  dist: string[];
  arch: number[];
  lang: string[];
  authorized_key: string[];
  host_key: string[];
}

interface VncConfig extends BaseBootConfig {
  dist: string[];
  arch: number[];
  lang: string[];
}

interface WindowsConfig extends BaseBootConfig {
  dist: string[];
  lang: string[];
}

interface PleskConfig extends BaseBootConfig {
  dist: string[];
  arch: number[];
  lang: string[];
  hostname: string | null;
}

interface CpanelConfig extends BaseBootConfig {
  dist: string[];
  arch: number[];
  lang: string[];
  hostname: string | null;
}

interface BootConfig {
  rescue: RescueConfig | null;
  linux: LinuxConfig | null;
  vnc: VncConfig | null;
  windows: WindowsConfig | null;
  plesk: PleskConfig | null;
  cpanel: CpanelConfig | null;
}`;

const ROBOT_RESCUE_CONFIG = `\
interface BaseBootConfig {
  server_ip: string;
  server_ipv6_net: string;
  server_number: number;
  active: boolean;
  password: string | null;
}

interface RescueConfig extends BaseBootConfig {
  os: string[];
  arch: number[];
  authorized_key: string[];
  host_key: string[];
}`;

const ROBOT_LINUX_CONFIG = `\
interface BaseBootConfig {
  server_ip: string;
  server_ipv6_net: string;
  server_number: number;
  active: boolean;
  password: string | null;
}

interface LinuxConfig extends BaseBootConfig {
  dist: string[];
  arch: number[];
  lang: string[];
  authorized_key: string[];
  host_key: string[];
}`;

const ROBOT_IP = `\
interface IP {
  ip: string;
  server_ip: string;
  server_number: number;
  locked: boolean;
  separate_mac: string | null;
  traffic_warnings: boolean;
  traffic_hourly: number;
  traffic_daily: number;
  traffic_monthly: number;
}`;

const ROBOT_MAC = `\
interface Mac {
  ip: string;
  mac: string;
}`;

const ROBOT_SUBNET = `\
interface Subnet {
  ip: string;
  mask: string;
  gateway: string;
  server_ip: string;
  server_number: number;
  failover: boolean;
  locked: boolean;
  traffic_warnings: boolean;
  traffic_hourly: number;
  traffic_daily: number;
  traffic_monthly: number;
}`;

const ROBOT_FAILOVER = `\
interface Failover {
  ip: string;
  netmask: string;
  server_ip: string;
  server_number: number;
  active_server_ip: string;
}`;

const ROBOT_RDNS = `\
interface Rdns {
  ip: string;
  ptr: string;
}`;

const ROBOT_SSH_KEY = `\
interface SshKey {
  name: string;
  fingerprint: string;
  type: string;
  size: number;
  data: string;
}`;

const ROBOT_FIREWALL_RULE = `\
interface FirewallRule {
  ip_version: string;
  name: string;
  dst_ip: string | null;
  dst_port: string | null;
  src_ip: string | null;
  src_port: string | null;
  protocol: string | null;
  tcp_flags: string | null;
  action: 'accept' | 'discard';
}`;

const ROBOT_FIREWALL = `\
${ROBOT_FIREWALL_RULE}

interface Firewall {
  server_ip: string;
  server_number: number;
  status: 'active' | 'disabled' | 'in process';
  filter_ipv6: boolean;
  whitelist_hos: boolean;
  port: 'main' | 'kvm';
  rules: {
    input: FirewallRule[];
    output?: FirewallRule[];
  };
}`;

const ROBOT_FIREWALL_TEMPLATE = `\
${ROBOT_FIREWALL_RULE}

interface FirewallTemplate {
  id: number;
  name: string;
  filter_ipv6: boolean;
  whitelist_hos: boolean;
  is_default: boolean;
  rules: {
    input: FirewallRule[];
    output?: FirewallRule[];
  };
}`;

const ROBOT_VSWITCH = `\
interface VSwitchServer {
  server_ip: string;
  server_ipv6_net: string;
  server_number: number;
  status: 'ready' | 'in process' | 'failed';
}

interface VSwitchSubnet {
  ip: string;
  mask: number;
  gateway: string;
}

interface VSwitchCloudNetwork {
  id: number;
  ip: string;
  mask: number;
  gateway: string;
}

interface VSwitch {
  id: number;
  name: string;
  vlan: number;
  cancelled: boolean;
  server: VSwitchServer[];
  subnet: VSwitchSubnet[];
  cloud_network: VSwitchCloudNetwork[];
}

type VSwitchSummary = Pick<VSwitch, 'id' | 'name' | 'vlan' | 'cancelled'>;`;

const ROBOT_STORAGEBOX = `\
interface StorageBox {
  id: number;
  login: string;
  name: string;
  product: string;
  cancelled: boolean;
  locked: boolean;
  location: string;
  linked_server: number | null;
  paid_until: string;
  disk_quota: number;
  disk_usage: number;
  disk_usage_data: number;
  disk_usage_snapshots: number;
  webdav: boolean;
  samba: boolean;
  ssh: boolean;
  external_reachability: boolean;
  zfs: boolean;
  server: string;
  host_system: string;
}`;

const ROBOT_STORAGEBOX_SNAPSHOT = `\
interface StorageBoxSnapshot {
  name: string;
  timestamp: string;
  size: number;
  size_formatted: string;
}`;

const ROBOT_STORAGEBOX_SUBACCOUNT = `\
interface StorageBoxSubaccount {
  username: string;
  accountid: string;
  server: string;
  homedirectory: string;
  samba: boolean;
  ssh: boolean;
  external_reachability: boolean;
  webdav: boolean;
  readonly: boolean;
  createtime: string;
  comment: string;
}`;

const ROBOT_TRAFFIC = `\
interface TrafficData {
  in: number;
  out: number;
  sum: number;
  date?: string;
}

interface Traffic {
  ip: string;
  type: 'day' | 'month' | 'year';
  from: string;
  to: string;
  data: TrafficData[];
}`;

const ROBOT_WOL = `\
interface Wol {
  server_ip: string;
  server_ipv6_net: string;
  server_number: number;
}`;

const ROBOT_CANCELLATION = `\
interface Cancellation {
  server_ip: string;
  server_ipv6_net: string;
  server_number: number;
  server_name: string;
  earliest_cancellation_date: string;
  cancelled: boolean;
  cancellation_date: string | null;
  cancellation_reason: string[] | null;
}`;

const ROBOT_PRODUCT_PRICE = `\
interface ProductPrice {
  location: string;
  price: { net: string; gross: string };
  price_setup: { net: string; gross: string };
  price_vat: { net: string; gross: string };
  price_setup_vat: { net: string; gross: string };
}`;

const ROBOT_SERVER_PRODUCT = `\
${ROBOT_PRODUCT_PRICE}

interface ServerProduct {
  id: string;
  name: string;
  description: string[];
  traffic: string;
  dist: string[];
  arch: number[];
  lang: string[];
  location: string[];
  prices: ProductPrice[];
  orderable_addons: string[];
}`;

const ROBOT_SERVER_MARKET_PRODUCT = `\
interface ServerMarketProduct {
  id: number;
  name: string;
  description: string[];
  traffic: string;
  dist: string[];
  arch: number[];
  lang: string[];
  cpu: string;
  cpu_benchmark: number;
  memory_size: number;
  hdd_size: number;
  hdd_text: string;
  hdd_count: number;
  datacenter: string;
  network_speed: string;
  price: string;
  price_setup: string;
  fixed_price: boolean;
  next_reduce: number;
  next_reduce_date: string;
  orderable_addons: string[];
}`;

const ROBOT_SERVER_TRANSACTION = `\
interface ServerTransactionProduct {
  id: string;
  name: string;
  description: string[];
  traffic: string;
  dist: string;
  arch: number;
  lang: string;
  location: string;
}

interface ServerTransaction {
  id: string;
  date: string;
  status: 'ready' | 'in process' | 'cancelled';
  server_number: number | null;
  server_ip: string | null;
  authorized_key: string[];
  host_key: string[];
  comment: string;
  product: ServerTransactionProduct;
}`;

// ---------------------------------------------------------------------------
// Cloud API shared type blocks
// ---------------------------------------------------------------------------

const CLOUD_LOCATION = `\
interface Location {
  id: number;
  name: string;
  description: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  network_zone: string;
}`;

const CLOUD_SERVER_TYPE_PRICE = `\
interface ServerTypePrice {
  location: string;
  price_hourly: { net: string; gross: string };
  price_monthly: { net: string; gross: string };
  included_traffic: number;
}`;

const CLOUD_DATACENTER = `\
${CLOUD_LOCATION}

interface Datacenter {
  id: number;
  name: string;
  description: string;
  location: Location;
  server_types: {
    supported: number[];
    available: number[];
    available_for_migration: number[];
  };
}`;

const CLOUD_SERVER_TYPE = `\
${CLOUD_SERVER_TYPE_PRICE}

interface ServerType {
  id: number;
  name: string;
  description: string;
  cores: number;
  memory: number;
  disk: number;
  storage_type: 'local' | 'network';
  cpu_type: 'shared' | 'dedicated';
  architecture: 'x86' | 'arm';
  deprecated: boolean;
  deprecation?: { announced: string; unavailable_after: string } | null;
  prices: ServerTypePrice[];
}`;

const CLOUD_ISO = `\
interface ISO {
  id: number;
  name: string;
  description: string;
  type: 'public' | 'private';
  deprecation?: { announced: string; unavailable_after: string } | null;
  architecture: 'x86' | 'arm' | null;
}`;

const CLOUD_PROTECTION = `\
type Labels = Record<string, string>;

interface Protection {
  delete: boolean;
  rebuild?: boolean;
}`;

const CLOUD_IMAGE = `\
${CLOUD_PROTECTION}

interface Image {
  id: number;
  type: 'system' | 'snapshot' | 'backup' | 'app';
  status: 'available' | 'creating' | 'unavailable';
  name: string | null;
  description: string;
  image_size: number | null;
  disk_size: number;
  created: string;
  created_from: { id: number; name: string } | null;
  bound_to: number | null;
  os_flavor: string;
  os_version: string | null;
  architecture: 'x86' | 'arm';
  rapid_deploy: boolean;
  protection: Protection;
  deprecated: string | null;
  deleted: string | null;
  labels: Labels;
}`;

const CLOUD_SSH_KEY = `\
type Labels = Record<string, string>;

interface CloudSshKey {
  id: number;
  name: string;
  fingerprint: string;
  public_key: string;
  labels: Labels;
  created: string;
}`;

const CLOUD_SERVER = `\
${CLOUD_PROTECTION}
${CLOUD_SERVER_TYPE_PRICE}

interface ServerType {
  id: number;
  name: string;
  description: string;
  cores: number;
  memory: number;
  disk: number;
  storage_type: 'local' | 'network';
  cpu_type: 'shared' | 'dedicated';
  architecture: 'x86' | 'arm';
  deprecated: boolean;
  deprecation?: { announced: string; unavailable_after: string } | null;
  prices: ServerTypePrice[];
}

${CLOUD_LOCATION}

interface Image {
  id: number;
  type: 'system' | 'snapshot' | 'backup' | 'app';
  status: 'available' | 'creating' | 'unavailable';
  name: string | null;
  description: string;
  image_size: number | null;
  disk_size: number;
  created: string;
  created_from: { id: number; name: string } | null;
  bound_to: number | null;
  os_flavor: string;
  os_version: string | null;
  architecture: 'x86' | 'arm';
  rapid_deploy: boolean;
  protection: Protection;
  deprecated: string | null;
  deleted: string | null;
  labels: Labels;
}

interface ISO {
  id: number;
  name: string;
  description: string;
  type: 'public' | 'private';
  deprecation?: { announced: string; unavailable_after: string } | null;
  architecture: 'x86' | 'arm' | null;
}

interface CloudServer {
  id: number;
  name: string;
  status: 'running' | 'initializing' | 'starting' | 'stopping' | 'off' | 'deleting' | 'migrating' | 'rebuilding' | 'unknown';
  public_net: {
    ipv4: { ip: string; dns_ptr: string; blocked: boolean } | null;
    ipv6: { ip: string; dns_ptr: { ip: string; dns_ptr: string }[]; blocked: boolean } | null;
    floating_ips: number[];
    firewalls: { id: number; status: 'applied' | 'pending' }[];
  };
  private_net: { network: number; ip: string; alias_ips: string[]; mac_address: string }[];
  server_type: ServerType;
  location: Location;
  image: Image | null;
  iso: ISO | null;
  rescue_enabled: boolean;
  locked: boolean;
  backup_window: string | null;
  outgoing_traffic: number | null;
  ingoing_traffic: number | null;
  included_traffic: number;
  protection: Protection;
  labels: Labels;
  volumes: number[];
  load_balancers: number[];
  primary_disk_size: number;
  created: string;
  placement_group?: { id: number; name: string; type: string } | null;
}`;

const CLOUD_NETWORK = `\
${CLOUD_PROTECTION}

interface NetworkSubnet {
  type: 'cloud' | 'server' | 'vswitch';
  ip_range: string;
  network_zone: string;
  gateway: string;
  vswitch_id?: number | null;
}

interface NetworkRoute {
  destination: string;
  gateway: string;
}

interface Network {
  id: number;
  name: string;
  ip_range: string;
  subnets: NetworkSubnet[];
  routes: NetworkRoute[];
  servers: number[];
  load_balancers: number[];
  protection: Protection;
  labels: Labels;
  created: string;
  expose_routes_to_vswitch: boolean;
}`;

const CLOUD_FIREWALL = `\
type Labels = Record<string, string>;

interface CloudFirewallRule {
  direction: 'in' | 'out';
  protocol: 'tcp' | 'udp' | 'icmp' | 'esp' | 'gre';
  port: string | null;
  source_ips: string[];
  destination_ips: string[];
  description: string | null;
}

interface CloudFirewallAppliedTo {
  type: 'server' | 'label_selector';
  server?: { id: number };
  label_selector?: { selector: string };
}

interface CloudFirewall {
  id: number;
  name: string;
  labels: Labels;
  rules: CloudFirewallRule[];
  applied_to: CloudFirewallAppliedTo[];
  created: string;
}`;

const CLOUD_FLOATING_IP = `\
type Labels = Record<string, string>;

interface Protection {
  delete: boolean;
}

${CLOUD_LOCATION}

interface FloatingIp {
  id: number;
  name: string;
  description: string;
  ip: string;
  type: 'ipv4' | 'ipv6';
  server: number | null;
  dns_ptr: { ip: string; dns_ptr: string }[];
  home_location: Location;
  blocked: boolean;
  protection: Protection;
  labels: Labels;
  created: string;
}`;

const CLOUD_PRIMARY_IP = `\
type Labels = Record<string, string>;

interface Protection {
  delete: boolean;
}

${CLOUD_LOCATION}

interface PrimaryIp {
  id: number;
  name: string;
  ip: string;
  type: 'ipv4' | 'ipv6';
  assignee_id: number | null;
  assignee_type: 'server';
  auto_delete: boolean;
  blocked: boolean;
  location: Location;
  dns_ptr: { ip: string; dns_ptr: string }[];
  labels: Labels;
  protection: Protection;
  created: string;
}`;

const CLOUD_VOLUME = `\
type Labels = Record<string, string>;

interface Protection {
  delete: boolean;
}

${CLOUD_LOCATION}

interface Volume {
  id: number;
  name: string;
  server: number | null;
  status: 'creating' | 'available' | 'attached';
  location: Location;
  size: number;
  linux_device: string | null;
  protection: Protection;
  labels: Labels;
  created: string;
  format: string | null;
}`;

const CLOUD_LOAD_BALANCER_TYPE = `\
${CLOUD_SERVER_TYPE_PRICE}

interface LoadBalancerType {
  id: number;
  name: string;
  description: string;
  max_connections: number;
  max_services: number;
  max_targets: number;
  max_assigned_certificates: number;
  deprecated: string | null;
  prices: ServerTypePrice[];
}`;

const CLOUD_LOAD_BALANCER = `\
type Labels = Record<string, string>;

interface Protection {
  delete: boolean;
}

${CLOUD_LOCATION}
${CLOUD_SERVER_TYPE_PRICE}

interface LoadBalancerType {
  id: number;
  name: string;
  description: string;
  max_connections: number;
  max_services: number;
  max_targets: number;
  max_assigned_certificates: number;
  deprecated: string | null;
  prices: ServerTypePrice[];
}

interface LoadBalancerTarget {
  type: 'server' | 'label_selector' | 'ip';
  server?: { id: number };
  label_selector?: { selector: string };
  ip?: { ip: string };
  health_status: { listen_port: number; status: 'healthy' | 'unhealthy' | 'unknown' }[];
  use_private_ip: boolean;
}

interface LoadBalancerService {
  protocol: 'tcp' | 'http' | 'https';
  listen_port: number;
  destination_port: number;
  proxyprotocol: boolean;
  health_check: {
    protocol: 'tcp' | 'http' | 'https';
    port: number;
    interval: number;
    timeout: number;
    retries: number;
    http?: {
      domain: string | null;
      path: string;
      response: string | null;
      status_codes: string[];
      tls: boolean;
    };
  };
  http?: {
    cookie_name: string;
    cookie_lifetime: number;
    certificates: number[];
    redirect_http: boolean;
    sticky_sessions: boolean;
  };
}

interface LoadBalancer {
  id: number;
  name: string;
  public_net: {
    enabled: boolean;
    ipv4: { ip: string; dns_ptr: string };
    ipv6: { ip: string; dns_ptr: string };
  };
  private_net: { network: number; ip: string }[];
  location: Location;
  load_balancer_type: LoadBalancerType;
  protection: Protection;
  labels: Labels;
  targets: LoadBalancerTarget[];
  services: LoadBalancerService[];
  algorithm: { type: 'round_robin' | 'least_connections' };
  outgoing_traffic: number | null;
  ingoing_traffic: number | null;
  included_traffic: number;
  created: string;
}`;

const CLOUD_CERTIFICATE = `\
type Labels = Record<string, string>;

interface Certificate {
  id: number;
  name: string;
  labels: Labels;
  type: 'uploaded' | 'managed';
  certificate: string | null;
  created: string;
  not_valid_before: string;
  not_valid_after: string;
  domain_names: string[];
  fingerprint: string | null;
  status: {
    issuance: 'pending' | 'completed' | 'failed';
    renewal: 'scheduled' | 'pending' | 'failed' | 'unavailable';
    error?: { code: string; message: string } | null;
  } | null;
  used_by: { id: number; type: string }[];
}`;

const CLOUD_PLACEMENT_GROUP = `\
type Labels = Record<string, string>;

interface PlacementGroup {
  id: number;
  name: string;
  labels: Labels;
  type: 'spread';
  servers: number[];
  created: string;
}`;

// ---------------------------------------------------------------------------
// Auction API shared type blocks
// ---------------------------------------------------------------------------

const AUCTION_SERVER = `\
interface AuctionDiskData {
  nvme: number[];
  sata: number[];
  hdd: number[];
  general: number[];
}

interface AuctionIpPrice {
  Monthly: number;
  Hourly: number;
  Amount: number;
}

interface AuctionServer {
  id: number;
  key: number;
  name: string;
  description: string[];
  information: string[] | null;
  cpu: string;
  cpu_count: number;
  is_highio: boolean;
  is_ecc: boolean;
  traffic: string;
  bandwidth: number;
  ram: string[];
  ram_size: number;
  price: number;
  setup_price: number;
  hourly_price: number;
  hdd_arr: string[];
  hdd_hr: string[];
  hdd_size: number;
  hdd_count: number;
  serverDiskData: AuctionDiskData;
  datacenter: string;
  datacenter_hr: string;
  specials: string[];
  dist: string[];
  fixed_price: boolean;
  next_reduce: number;
  next_reduce_hr: boolean;
  next_reduce_timestamp: number;
  ip_price: AuctionIpPrice;
  category?: string;
  cat_id?: number;
}`;

const AUCTION_STATUS = `\
interface AuctionCacheStatus {
  ageSeconds?: number;
  fetchedAt: string;
  serverCount: number;
  source: string;
  stale: boolean;
  updatedAt?: string;
  url: string;
}

interface AuctionStatus extends AuctionCacheStatus {
  currency: 'EUR' | 'USD';
  endpointUrl: string;
  localCache: AuctionCacheStatus | null;
  usingLocalFallback: boolean;
}`;

// ---------------------------------------------------------------------------
// Schema registry
// ---------------------------------------------------------------------------

export const outputSchemas: Record<string, string> = {
  // ==================== Robot API ====================

  // --- server ---
  "server list": `${ROBOT_SERVER}\n\ntype Output = { server: Server }[];`,
  "server get": `${ROBOT_SERVER_DETAILS}\n\ntype Output = ServerDetails;`,

  // --- reset ---
  "reset options": `${ROBOT_RESET}\n\ntype Output = { reset: Reset }[] | Reset;`,

  // --- boot ---
  "boot status": `${ROBOT_BOOT_CONFIG}\n\ntype Output = BootConfig;`,
  "boot rescue last": `${ROBOT_RESCUE_CONFIG}\n\ntype Output = RescueConfig;`,
  "boot linux options": `${ROBOT_LINUX_CONFIG}\n\ntype Output = LinuxConfig;`,

  // --- ip ---
  "ip list": `${ROBOT_IP}\n\ntype Output = { ip: IP }[];`,
  "ip get": `${ROBOT_IP}\n\ntype Output = IP;`,

  // --- ip mac ---
  "ip mac get": `${ROBOT_MAC}\n\ntype Output = Mac;`,

  // --- subnet ---
  "subnet list": `${ROBOT_SUBNET}\n\ntype Output = { subnet: Subnet }[];`,
  "subnet get": `${ROBOT_SUBNET}\n\ntype Output = { subnet: Subnet }[];`,

  // --- failover ---
  "failover list": `${ROBOT_FAILOVER}\n\ntype Output = { failover: Failover }[];`,
  "failover get": `${ROBOT_FAILOVER}\n\ntype Output = { failover: Failover }[];`,

  // --- rdns ---
  "rdns list": `${ROBOT_RDNS}\n\ntype Output = { rdns: Rdns }[];`,
  "rdns get": `${ROBOT_RDNS}\n\ntype Output = Rdns;`,

  // --- key ---
  "key list": `${ROBOT_SSH_KEY}\n\ntype Output = { key: SshKey }[];`,
  "key get": `${ROBOT_SSH_KEY}\n\ntype Output = SshKey;`,

  // --- firewall ---
  "firewall get": `${ROBOT_FIREWALL}\n\ntype Output = Firewall;`,

  // --- firewall template ---
  "firewall template list": `${ROBOT_FIREWALL_TEMPLATE}\n\ntype Output = { firewall_template: FirewallTemplate }[];`,
  "firewall template get": `${ROBOT_FIREWALL_TEMPLATE}\n\ntype Output = { firewall_template: FirewallTemplate }[];`,

  // --- vswitch ---
  "vswitch list": `${ROBOT_VSWITCH}\n\ntype Output = VSwitchSummary[];`,
  "vswitch get": `${ROBOT_VSWITCH}\n\ntype Output = VSwitch;`,

  // --- storagebox ---
  "storagebox list": `${ROBOT_STORAGEBOX}\n\ntype Output = { storagebox: StorageBox }[];`,
  "storagebox get": `${ROBOT_STORAGEBOX}\n\ntype Output = StorageBox;`,

  // --- storagebox snapshot ---
  "storagebox snapshot list": `${ROBOT_STORAGEBOX_SNAPSHOT}\n\ntype Output = { snapshot: StorageBoxSnapshot }[];`,

  // --- storagebox subaccount ---
  "storagebox subaccount list": `${ROBOT_STORAGEBOX_SUBACCOUNT}\n\ntype Output = { subaccount: StorageBoxSubaccount }[];`,

  // --- traffic ---
  "traffic query": `${ROBOT_TRAFFIC}\n\ntype Output = Traffic;`,

  // --- wol ---
  "wol status": `${ROBOT_WOL}\n\ntype Output = Wol;`,

  // --- cancel ---
  "cancel status": `${ROBOT_CANCELLATION}\n\ntype Output = Cancellation;`,

  // --- order ---
  "order products": `${ROBOT_SERVER_PRODUCT}\n\ntype Output = { product: ServerProduct }[];`,
  "order market": `${ROBOT_SERVER_MARKET_PRODUCT}\n\ntype Output = { product: ServerMarketProduct }[];`,
  "order transactions": `${ROBOT_SERVER_TRANSACTION}\n\ntype Output = { transaction: ServerTransaction }[];`,
  "order transaction": `${ROBOT_SERVER_TRANSACTION}\n\ntype Output = { transaction: ServerTransaction }[];`,

  // ==================== Cloud API ====================

  // --- cloud server ---
  "cloud server list": `${CLOUD_SERVER}\n\ntype Output = CloudServer[];`,
  "cloud server describe": `${CLOUD_SERVER}\n\ntype Output = CloudServer;`,

  // --- cloud image ---
  "cloud image list": `${CLOUD_IMAGE}\n\ntype Output = Image[];`,
  "cloud image describe": `${CLOUD_IMAGE}\n\ntype Output = Image;`,

  // --- cloud volume ---
  "cloud volume list": `${CLOUD_VOLUME}\n\ntype Output = Volume[];`,
  "cloud volume describe": `${CLOUD_VOLUME}\n\ntype Output = Volume;`,

  // --- cloud network ---
  "cloud network list": `${CLOUD_NETWORK}\n\ntype Output = Network[];`,
  "cloud network describe": `${CLOUD_NETWORK}\n\ntype Output = Network;`,

  // --- cloud firewall ---
  "cloud firewall list": `${CLOUD_FIREWALL}\n\ntype Output = CloudFirewall[];`,
  "cloud firewall describe": `${CLOUD_FIREWALL}\n\ntype Output = CloudFirewall;`,

  // --- cloud floating-ip ---
  "cloud floating-ip list": `${CLOUD_FLOATING_IP}\n\ntype Output = FloatingIp[];`,
  "cloud floating-ip describe": `${CLOUD_FLOATING_IP}\n\ntype Output = FloatingIp;`,

  // --- cloud primary-ip ---
  "cloud primary-ip list": `${CLOUD_PRIMARY_IP}\n\ntype Output = PrimaryIp[];`,
  "cloud primary-ip describe": `${CLOUD_PRIMARY_IP}\n\ntype Output = PrimaryIp;`,

  // --- cloud ssh-key ---
  "cloud ssh-key list": `${CLOUD_SSH_KEY}\n\ntype Output = CloudSshKey[];`,
  "cloud ssh-key describe": `${CLOUD_SSH_KEY}\n\ntype Output = CloudSshKey;`,

  // --- cloud certificate ---
  "cloud certificate list": `${CLOUD_CERTIFICATE}\n\ntype Output = Certificate[];`,
  "cloud certificate describe": `${CLOUD_CERTIFICATE}\n\ntype Output = Certificate;`,

  // --- cloud load-balancer ---
  "cloud load-balancer list": `${CLOUD_LOAD_BALANCER}\n\ntype Output = LoadBalancer[];`,
  "cloud load-balancer describe": `${CLOUD_LOAD_BALANCER}\n\ntype Output = LoadBalancer;`,

  // --- cloud placement-group ---
  "cloud placement-group list": `${CLOUD_PLACEMENT_GROUP}\n\ntype Output = PlacementGroup[];`,
  "cloud placement-group describe": `${CLOUD_PLACEMENT_GROUP}\n\ntype Output = PlacementGroup;`,

  // --- cloud datacenter ---
  "cloud datacenter list": `${CLOUD_DATACENTER}\n\ntype Output = Datacenter[];`,
  "cloud datacenter describe": `${CLOUD_DATACENTER}\n\ntype Output = Datacenter;`,

  // --- cloud location ---
  "cloud location list": `${CLOUD_LOCATION}\n\ntype Output = Location[];`,
  "cloud location describe": `${CLOUD_LOCATION}\n\ntype Output = Location;`,

  // --- cloud server-type ---
  "cloud server-type list": `${CLOUD_SERVER_TYPE}\n\ntype Output = ServerType[];`,
  "cloud server-type describe": `${CLOUD_SERVER_TYPE}\n\ntype Output = ServerType;`,

  // --- cloud load-balancer-type ---
  "cloud load-balancer-type list": `${CLOUD_LOAD_BALANCER_TYPE}\n\ntype Output = LoadBalancerType[];`,
  "cloud load-balancer-type describe": `${CLOUD_LOAD_BALANCER_TYPE}\n\ntype Output = LoadBalancerType;`,

  // --- cloud iso ---
  "cloud iso list": `${CLOUD_ISO}\n\ntype Output = ISO[];`,
  "cloud iso describe": `${CLOUD_ISO}\n\ntype Output = ISO;`,

  // ==================== Auction API ====================

  "auction list": `${AUCTION_SERVER}\n\ntype Output = AuctionServer[];`,
  "auction show": `${AUCTION_SERVER}\n\ntype Output = AuctionServer;`,
  "auction status": `${AUCTION_STATUS}\n\ntype Output = AuctionStatus;`,
};
