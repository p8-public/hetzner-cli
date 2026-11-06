// ============================================================================
// Hetzner Cloud API Types
// Based on: https://docs.hetzner.cloud/
// ============================================================================

// Common types
export type Labels = Record<string, string>;

export interface CloudAction {
  command: string;
  error: { code: string; message: string } | null;
  finished: string | null;
  id: number;
  progress: number;
  resources: { id: number; type: string }[];
  started: string;
  status: "running" | "success" | "error";
}

export interface PaginationMeta {
  pagination: {
    page: number;
    per_page: number;
    previous_page: number | null;
    next_page: number | null;
    last_page: number;
    total_entries: number;
  };
}

export interface CloudApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Protection
export interface Protection {
  delete: boolean;
  rebuild?: boolean;
}

// Datacenter
export interface Datacenter {
  description: string;
  id: number;
  location: Location;
  name: string;
  server_types: {
    supported: number[];
    available: number[];
    available_for_migration: number[];
  };
}

// Location
export interface Location {
  city: string;
  country: string;
  description: string;
  id: number;
  latitude: number;
  longitude: number;
  name: string;
  network_zone: string;
}

// Server Type
export interface ServerType {
  architecture: "x86" | "arm";
  cores: number;
  cpu_type: "shared" | "dedicated";
  deprecated: boolean;
  deprecation?: {
    announced: string;
    unavailable_after: string;
  } | null;
  description: string;
  disk: number;
  id: number;
  memory: number;
  name: string;
  prices: ServerTypePrice[];
  storage_type: "local" | "network";
}

export interface ServerTypePrice {
  included_traffic: number;
  location: string;
  price_hourly: { net: string; gross: string };
  price_monthly: { net: string; gross: string };
}

// ISO
export interface ISO {
  architecture: "x86" | "arm" | null;
  deprecation?: {
    announced: string;
    unavailable_after: string;
  } | null;
  description: string;
  id: number;
  name: string;
  type: "public" | "private";
}

// Image
export interface Image {
  architecture: "x86" | "arm";
  bound_to: number | null;
  created: string;
  created_from: { id: number; name: string } | null;
  deleted: string | null;
  deprecated: string | null;
  description: string;
  disk_size: number;
  id: number;
  image_size: number | null;
  labels: Labels;
  name: string | null;
  os_flavor: string;
  os_version: string | null;
  protection: Protection;
  rapid_deploy: boolean;
  status: "available" | "creating" | "unavailable";
  type: "system" | "snapshot" | "backup" | "app";
}

// SSH Key (Cloud)
export interface CloudSshKey {
  created: string;
  fingerprint: string;
  id: number;
  labels: Labels;
  name: string;
  public_key: string;
}

// Server
export interface CloudServer {
  backup_window: string | null;
  created: string;
  datacenter?: Datacenter;
  id: number;
  image: Image | null;
  included_traffic: number;
  ingoing_traffic: number | null;
  iso: ISO | null;
  labels: Labels;
  load_balancers: number[];
  location: Location;
  locked: boolean;
  name: string;
  outgoing_traffic: number | null;
  placement_group?: { id: number; name: string; type: string } | null;
  primary_disk_size: number;
  private_net: {
    network: number;
    ip: string;
    alias_ips: string[];
    mac_address: string;
  }[];
  protection: Protection;
  public_net: {
    ipv4: { ip: string; dns_ptr: string; blocked: boolean } | null;
    ipv6: {
      ip: string;
      dns_ptr: { ip: string; dns_ptr: string }[];
      blocked: boolean;
    } | null;
    floating_ips: number[];
    firewalls: { id: number; status: "applied" | "pending" }[];
  };
  rescue_enabled: boolean;
  server_type?: ServerType;
  status:
    | "running"
    | "initializing"
    | "starting"
    | "stopping"
    | "off"
    | "deleting"
    | "migrating"
    | "rebuilding"
    | "unknown";
  volumes: number[];
}

// Network
export interface Network {
  created: string;
  expose_routes_to_vswitch: boolean;
  id: number;
  ip_range: string;
  labels: Labels;
  load_balancers: number[];
  name: string;
  protection: Protection;
  routes: NetworkRoute[];
  servers: number[];
  subnets: NetworkSubnet[];
}

export interface NetworkSubnet {
  gateway: string;
  ip_range: string;
  network_zone: string;
  type: "cloud" | "server" | "vswitch";
  vswitch_id?: number | null;
}

export interface NetworkRoute {
  destination: string;
  gateway: string;
}

// Cloud Firewall
export interface CloudFirewall {
  applied_to: CloudFirewallAppliedTo[];
  created: string;
  id: number;
  labels: Labels;
  name: string;
  rules: CloudFirewallRule[];
}

export interface CloudFirewallRule {
  description: string | null;
  destination_ips: string[];
  direction: "in" | "out";
  port: string | null;
  protocol: "tcp" | "udp" | "icmp" | "esp" | "gre";
  source_ips: string[];
}

export interface CloudFirewallAppliedTo {
  label_selector?: { selector: string };
  server?: { id: number };
  type: "server" | "label_selector";
}

// Floating IP
export interface FloatingIp {
  blocked: boolean;
  created: string;
  description: string;
  dns_ptr: { ip: string; dns_ptr: string }[];
  home_location: Location;
  id: number;
  ip: string;
  labels: Labels;
  name: string;
  protection: Protection;
  server: number | null;
  type: "ipv4" | "ipv6";
}

// Primary IP
export interface PrimaryIp {
  assignee_id: number | null;
  assignee_type: "server" | "load_balancer" | "unassigned";
  auto_delete: boolean;
  blocked: boolean;
  created: string;
  dns_ptr: { ip: string; dns_ptr: string }[];
  id: number;
  ip: string;
  labels: Labels;
  location: Location;
  name: string;
  protection: Protection;
  type: "ipv4" | "ipv6";
}

// Volume
export interface Volume {
  created: string;
  format: string | null;
  id: number;
  labels: Labels;
  linux_device: string | null;
  location: Location;
  name: string;
  protection: Protection;
  server: number | null;
  size: number;
  status: "creating" | "available" | "attached";
}

// Load Balancer
export interface LoadBalancer {
  algorithm: { type: "round_robin" | "least_connections" };
  created: string;
  id: number;
  included_traffic: number;
  ingoing_traffic: number | null;
  labels: Labels;
  load_balancer_type: LoadBalancerType;
  location: Location;
  name: string;
  outgoing_traffic: number | null;
  private_net: { network: number; ip: string }[];
  protection: Protection;
  public_net: {
    enabled: boolean;
    ipv4: { ip: string; dns_ptr: string };
    ipv6: { ip: string; dns_ptr: string };
  };
  services: LoadBalancerService[];
  targets: LoadBalancerTarget[];
}

export interface LoadBalancerType {
  deprecated: string | null;
  description: string;
  id: number;
  max_assigned_certificates: number;
  max_connections: number;
  max_services: number;
  max_targets: number;
  name: string;
  prices: ServerTypePrice[];
}

export interface LoadBalancerTarget {
  health_status: {
    listen_port: number;
    status: "healthy" | "unhealthy" | "unknown";
  }[];
  ip?: { ip: string };
  label_selector?: { selector: string };
  server?: { id: number };
  type: "server" | "label_selector" | "ip";
  use_private_ip: boolean;
}

export interface LoadBalancerService {
  destination_port: number;
  health_check: {
    protocol: "tcp" | "http" | "https";
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
  listen_port: number;
  protocol: "tcp" | "http" | "https";
  proxyprotocol: boolean;
}

// Certificate
export interface Certificate {
  certificate: string | null;
  created: string;
  domain_names: string[];
  fingerprint: string | null;
  id: number;
  labels: Labels;
  name: string;
  not_valid_after: string;
  not_valid_before: string;
  status: {
    issuance: "pending" | "completed" | "failed";
    renewal: "scheduled" | "pending" | "failed" | "unavailable";
    error?: { code: string; message: string } | null;
  } | null;
  type: "uploaded" | "managed";
  used_by: { id: number; type: string }[];
}

// Placement Group
export interface PlacementGroup {
  created: string;
  id: number;
  labels: Labels;
  name: string;
  servers: number[];
  type: "spread";
}

// Pricing (GET /pricing)
export interface PriceAmount {
  gross: string;
  net: string;
}

/** Location-bound price entry; hourly is absent on floating IPs. */
export interface IpPrice {
  location: string;
  price_hourly?: PriceAmount;
  price_monthly: PriceAmount;
}

export interface PricingServerTypePrice extends ServerTypePrice {
  price_per_tb_traffic?: PriceAmount;
}

export interface NamedTypePricing {
  name: string;
  prices: PricingServerTypePrice[];
}

export interface IpTypePricing {
  prices: IpPrice[];
  type: "ipv4" | "ipv6";
}

export interface CloudPricing {
  currency: string;
  floating_ips: IpTypePricing[];
  image: { price_per_gb_month: PriceAmount };
  load_balancer_types: NamedTypePricing[];
  primary_ips: IpTypePricing[];
  server_backup: { percentage: string };
  server_types: NamedTypePricing[];
  vat_rate: string;
  volume: { price_per_gb_month: PriceAmount };
}
