// ============================================================================
// Hetzner Robot API Types
// Based on: https://robot.hetzner.com/doc/webservice/en.html
// ============================================================================

// Server Types
export interface Server {
  cancelled: boolean;
  dc: string;
  ip: string[];
  paid_until: string;
  product: string;
  server_ip: string;
  server_ipv6_net: string;
  server_name: string;
  server_number: number;
  status: "ready" | "installing" | "maintenance";
  subnet: ServerSubnet[];
  traffic: string;
}

export interface ServerSubnet {
  ip: string;
  mask: string;
}

export interface ServerDetails extends Server {
  cpanel: boolean;
  hot_swap: boolean;
  plesk: boolean;
  rescue: boolean;
  reset: boolean;
  vnc: boolean;
  windows: boolean;
  wol: boolean;
}

// Cancellation Types
export interface Cancellation {
  cancellation_date: string | null;
  cancellation_reason: string[] | null;
  cancelled: boolean;
  earliest_cancellation_date: string;
  server_ip: string;
  server_ipv6_net: string;
  server_name: string;
  server_number: number;
}

// Reset Types
export type ResetType = "sw" | "hw" | "man" | "power" | "power_long";

export interface Reset {
  operating_status: string;
  server_ip: string;
  server_ipv6_net: string;
  server_number: number;
  type: ResetType[];
}

// Boot Types
export interface BootConfig {
  cpanel: CpanelConfig | null;
  linux: LinuxConfig | null;
  plesk: PleskConfig | null;
  rescue: RescueConfig | null;
  vnc: VncConfig | null;
  windows: WindowsConfig | null;
}

interface BaseBootConfig {
  active: boolean;
  password: string | null;
  server_ip: string;
  server_ipv6_net: string;
  server_number: number;
}

export interface RescueConfig extends BaseBootConfig {
  arch: number[];
  authorized_key: string[];
  host_key: string[];
  os: string[];
}

export interface LinuxConfig extends BaseBootConfig {
  arch: number[];
  authorized_key: string[];
  dist: string[];
  host_key: string[];
  lang: string[];
}

export interface VncConfig extends BaseBootConfig {
  arch: number[];
  dist: string[];
  lang: string[];
}

export interface WindowsConfig extends BaseBootConfig {
  dist: string[];
  lang: string[];
}

export interface PleskConfig extends BaseBootConfig {
  arch: number[];
  dist: string[];
  hostname: string | null;
  lang: string[];
}

export interface CpanelConfig extends BaseBootConfig {
  arch: number[];
  dist: string[];
  hostname: string | null;
  lang: string[];
}

// IP Types
export interface IP {
  ip: string;
  locked: boolean;
  separate_mac: string | null;
  server_ip: string;
  server_number: number;
  traffic_daily: number;
  traffic_hourly: number;
  traffic_monthly: number;
  traffic_warnings: boolean;
}

export interface Mac {
  ip: string;
  mac: string;
}

// Subnet Types
export interface Subnet {
  failover: boolean;
  gateway: string;
  ip: string;
  locked: boolean;
  mask: string;
  server_ip: string;
  server_number: number;
  traffic_daily: number;
  traffic_hourly: number;
  traffic_monthly: number;
  traffic_warnings: boolean;
}

// Failover Types
export interface Failover {
  active_server_ip: string;
  ip: string;
  netmask: string;
  server_ip: string;
  server_number: number;
}

// Reverse DNS Types
export interface Rdns {
  ip: string;
  ptr: string;
}

// SSH Key Types
export interface SshKey {
  data: string;
  fingerprint: string;
  name: string;
  size: number;
  type: string;
}

// Firewall Types
export interface Firewall {
  filter_ipv6: boolean;
  port: "main" | "kvm";
  rules: {
    input: FirewallRule[];
    output?: FirewallRule[];
  };
  server_ip: string;
  server_number: number;
  status: "active" | "disabled" | "in process";
  whitelist_hos: boolean;
}

export interface FirewallRule {
  action: "accept" | "discard";
  dst_ip: string | null;
  dst_port: string | null;
  ip_version: string;
  name: string;
  protocol: string | null;
  src_ip: string | null;
  src_port: string | null;
  tcp_flags: string | null;
}

export interface FirewallTemplate {
  filter_ipv6: boolean;
  id: number;
  is_default: boolean;
  name: string;
  rules: {
    input: FirewallRule[];
    output?: FirewallRule[];
  };
  whitelist_hos: boolean;
}

// vSwitch Types
// Unlike most Robot resources, vSwitch responses are not wrapped in a
// resource-named key. The list endpoint returns summaries only.
export type VSwitchSummary = Pick<
  VSwitch,
  "cancelled" | "id" | "name" | "vlan"
>;

export interface VSwitch {
  cancelled: boolean;
  cloud_network: VSwitchCloudNetwork[];
  id: number;
  name: string;
  server: VSwitchServer[];
  subnet: VSwitchSubnet[];
  vlan: number;
}

export interface VSwitchServer {
  server_ip: string;
  server_ipv6_net: string;
  server_number: number;
  status: "ready" | "in process" | "failed";
}

export interface VSwitchSubnet {
  gateway: string;
  ip: string;
  mask: number;
}

export interface VSwitchCloudNetwork {
  gateway: string;
  id: number;
  ip: string;
  mask: number;
}

// Storage Box Types
export interface StorageBox {
  cancelled: boolean;
  disk_quota: number;
  disk_usage: number;
  disk_usage_data: number;
  disk_usage_snapshots: number;
  external_reachability: boolean;
  host_system: string;
  id: number;
  linked_server: number | null;
  location: string;
  locked: boolean;
  login: string;
  name: string;
  paid_until: string;
  product: string;
  samba: boolean;
  server: string;
  ssh: boolean;
  webdav: boolean;
  zfs: boolean;
}

export interface StorageBoxSnapshot {
  name: string;
  size: number;
  size_formatted: string;
  timestamp: string;
}

export interface StorageBoxSnapshotPlan {
  day_of_month: number;
  day_of_week: number;
  hour: number;
  max_snapshots: number;
  minute: number;
  status: "enabled" | "disabled";
}

export interface StorageBoxSubaccount {
  accountid: string;
  comment: string;
  createtime: string;
  external_reachability: boolean;
  homedirectory: string;
  readonly: boolean;
  samba: boolean;
  server: string;
  ssh: boolean;
  username: string;
  webdav: boolean;
}

// Traffic Types
export interface Traffic {
  data: TrafficData[];
  from: string;
  ip: string;
  to: string;
  type: "day" | "month" | "year";
}

export interface TrafficData {
  date?: string;
  in: number;
  out: number;
  sum: number;
}

// Wake on LAN Types
export interface Wol {
  server_ip: string;
  server_ipv6_net: string;
  server_number: number;
}

// Order Types
export interface ServerProduct {
  arch: number[];
  description: string[];
  dist: string[];
  id: string;
  lang: string[];
  location: string[];
  name: string;
  orderable_addons: string[];
  prices: ProductPrice[];
  traffic: string;
}

export interface ProductPrice {
  location: string;
  price: {
    net: string;
    gross: string;
  };
  price_setup: {
    net: string;
    gross: string;
  };
  price_setup_vat: {
    net: string;
    gross: string;
  };
  price_vat: {
    net: string;
    gross: string;
  };
}

export interface ServerMarketProduct {
  arch: number[];
  cpu: string;
  cpu_benchmark: number;
  datacenter: string;
  description: string[];
  dist: string[];
  fixed_price: boolean;
  hdd_count: number;
  hdd_size: number;
  hdd_text: string;
  id: number;
  lang: string[];
  memory_size: number;
  name: string;
  network_speed: string;
  next_reduce: number;
  next_reduce_date: string;
  orderable_addons: string[];
  price: string;
  price_setup: string;
  traffic: string;
}

export interface ServerTransaction {
  authorized_key: string[];
  comment: string;
  date: string;
  host_key: string[];
  id: string;
  product: ServerTransactionProduct;
  server_ip: string | null;
  server_number: number | null;
  status: "ready" | "in process" | "cancelled";
}

export interface ServerTransactionProduct {
  arch: number;
  description: string[];
  dist: string;
  id: string;
  lang: string;
  location: string;
  name: string;
  traffic: string;
}

// API Response Wrappers
export type ApiResponse<T> = Record<string, T>;

export interface ApiError {
  error: {
    status: number;
    code: string;
    message: string;
  };
}
