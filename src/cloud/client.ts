// ============================================================================
// Hetzner Cloud API Client
// Base URL: https://api.hetzner.cloud/v1
// Auth: Bearer Token
// ============================================================================

import type {
  Certificate,
  CloudAction,
  CloudFirewall,
  CloudFirewallRule,
  CloudPricing,
  CloudServer,
  CloudSshKey,
  Datacenter,
  FloatingIp,
  Image,
  ISO,
  Labels,
  LoadBalancer,
  LoadBalancerType,
  Location,
  Network,
  NetworkRoute,
  NetworkSubnet,
  PaginationMeta,
  PlacementGroup,
  PrimaryIp,
  ServerType,
  Volume,
} from "./types.js";

const BASE_URL = "https://api.hetzner.cloud/v1";

export class HetznerCloudClient {
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;

    const headers: HeadersInit = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorBody = (await response.json()) as {
          error?: { code?: string; message?: string };
        };
        if (errorBody.error) {
          errorMessage = `${errorBody.error.code ?? "ERROR"}: ${errorBody.error.message ?? "Unknown error"}`;
        }
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  private buildQuery(
    params: Record<string, string | number | boolean | undefined>
  ): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) {
        continue;
      }
      parts.push(
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
      );
    }
    return parts.length > 0 ? `?${parts.join("&")}` : "";
  }

  /**
   * Fetch all pages of a paginated endpoint.
   */
  async listAll<T>(
    endpoint: string,
    key: string,
    params: Record<string, string | number | boolean | undefined> = {}
  ): Promise<T[]> {
    const allItems: T[] = [];
    let page = 1;
    const perPage = 50;

    while (true) {
      const query = this.buildQuery({ ...params, page, per_page: perPage });
      const response = await this.request<Record<string, unknown>>(
        `${endpoint}${query}`
      );
      const items = response[key] as T[];
      if (!items || items.length === 0) {
        break;
      }
      allItems.push(...items);

      const meta = response.meta as PaginationMeta | undefined;
      if (!meta?.pagination?.next_page) {
        break;
      }
      page = meta.pagination.next_page;
    }

    return allItems;
  }

  /**
   * Poll an action until it completes.
   */
  async waitForAction(
    actionId: number,
    timeoutMs = 300_000
  ): Promise<CloudAction> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const { action } = await this.request<{ action: CloudAction }>(
        `/actions/${actionId}`
      );
      if (action.status === "success") {
        return action;
      }
      if (action.status === "error") {
        throw new Error(
          `Action ${actionId} failed: ${action.error?.message ?? "Unknown error"}`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Action ${actionId} timed out after ${timeoutMs}ms`);
  }

  // =========================================================================
  // Datacenters (read-only)
  // =========================================================================

  // =========================================================================
  // Pricing (read-only)
  // =========================================================================

  async getPricing(): Promise<CloudPricing> {
    const { pricing } = await this.request<{ pricing: CloudPricing }>(
      "/pricing"
    );
    return pricing;
  }

  async listDatacenters(params: { name?: string } = {}): Promise<Datacenter[]> {
    return await this.listAll<Datacenter>(
      "/datacenters",
      "datacenters",
      params
    );
  }

  async getDatacenter(id: number): Promise<Datacenter> {
    const { datacenter } = await this.request<{ datacenter: Datacenter }>(
      `/datacenters/${id}`
    );
    return datacenter;
  }

  // =========================================================================
  // Locations (read-only)
  // =========================================================================

  async listLocations(params: { name?: string } = {}): Promise<Location[]> {
    return await this.listAll<Location>("/locations", "locations", params);
  }

  async getLocation(id: number): Promise<Location> {
    const { location } = await this.request<{ location: Location }>(
      `/locations/${id}`
    );
    return location;
  }

  // =========================================================================
  // Server Types (read-only)
  // =========================================================================

  async listServerTypes(params: { name?: string } = {}): Promise<ServerType[]> {
    return await this.listAll<ServerType>(
      "/server_types",
      "server_types",
      params
    );
  }

  async getServerType(id: number): Promise<ServerType> {
    const { server_type } = await this.request<{ server_type: ServerType }>(
      `/server_types/${id}`
    );
    return server_type;
  }

  // =========================================================================
  // Load Balancer Types (read-only)
  // =========================================================================

  async listLoadBalancerTypes(
    params: { name?: string } = {}
  ): Promise<LoadBalancerType[]> {
    return await this.listAll<LoadBalancerType>(
      "/load_balancer_types",
      "load_balancer_types",
      params
    );
  }

  async getLoadBalancerType(id: number): Promise<LoadBalancerType> {
    const { load_balancer_type } = await this.request<{
      load_balancer_type: LoadBalancerType;
    }>(`/load_balancer_types/${id}`);
    return load_balancer_type;
  }

  // =========================================================================
  // ISOs (read-only)
  // =========================================================================

  async listIsos(
    params: { name?: string; architecture?: string } = {}
  ): Promise<ISO[]> {
    return await this.listAll<ISO>("/isos", "isos", params);
  }

  async getIso(id: number): Promise<ISO> {
    const { iso } = await this.request<{ iso: ISO }>(`/isos/${id}`);
    return iso;
  }

  // =========================================================================
  // Servers
  // =========================================================================

  async listServers(
    params: {
      label_selector?: string;
      name?: string;
      sort?: string;
      status?: string;
    } = {}
  ): Promise<CloudServer[]> {
    return await this.listAll<CloudServer>("/servers", "servers", params);
  }

  async getServer(id: number): Promise<CloudServer> {
    const { server } = await this.request<{ server: CloudServer }>(
      `/servers/${id}`
    );
    return server;
  }

  async createServer(opts: {
    name: string;
    server_type: string;
    image: string;
    location?: string;
    ssh_keys?: (string | number)[];
    user_data?: string;
    labels?: Labels;
    automount?: boolean;
    volumes?: number[];
    networks?: number[];
    firewalls?: { firewall: number }[];
    placement_group?: number;
    public_net?: {
      enable_ipv4?: boolean;
      enable_ipv6?: boolean;
      ipv4?: number;
      ipv6?: number;
    };
    start_after_create?: boolean;
  }): Promise<{
    server: CloudServer;
    action: CloudAction;
    root_password: string | null;
  }> {
    return await this.request("/servers", {
      method: "POST",
      body: JSON.stringify(opts),
    });
  }

  async deleteServer(id: number): Promise<{ action: CloudAction }> {
    return await this.request<{ action: CloudAction }>(`/servers/${id}`, {
      method: "DELETE",
    });
  }

  async updateServer(
    id: number,
    opts: { name?: string; labels?: Labels }
  ): Promise<{ server: CloudServer }> {
    return await this.request(`/servers/${id}`, {
      method: "PUT",
      body: JSON.stringify(opts),
    });
  }

  async powerOnServer(id: number): Promise<{ action: CloudAction }> {
    return await this.request(`/servers/${id}/actions/poweron`, {
      method: "POST",
    });
  }

  async powerOffServer(id: number): Promise<{ action: CloudAction }> {
    return await this.request(`/servers/${id}/actions/poweroff`, {
      method: "POST",
    });
  }

  async rebootServer(id: number): Promise<{ action: CloudAction }> {
    return await this.request(`/servers/${id}/actions/reboot`, {
      method: "POST",
    });
  }

  async resetServer(id: number): Promise<{ action: CloudAction }> {
    return await this.request(`/servers/${id}/actions/reset`, {
      method: "POST",
    });
  }

  async shutdownServer(id: number): Promise<{ action: CloudAction }> {
    return await this.request(`/servers/${id}/actions/shutdown`, {
      method: "POST",
    });
  }

  async rebuildServer(
    id: number,
    image: string
  ): Promise<{ action: CloudAction; root_password: string | null }> {
    return await this.request(`/servers/${id}/actions/rebuild`, {
      method: "POST",
      body: JSON.stringify({ image }),
    });
  }

  async changeServerType(
    id: number,
    serverType: string,
    upgradeDisk: boolean
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/servers/${id}/actions/change_type`, {
      method: "POST",
      body: JSON.stringify({
        server_type: serverType,
        upgrade_disk: upgradeDisk,
      }),
    });
  }

  async enableServerRescue(
    id: number,
    type = "linux64",
    sshKeys?: number[]
  ): Promise<{ action: CloudAction; root_password: string }> {
    return await this.request(`/servers/${id}/actions/enable_rescue`, {
      method: "POST",
      body: JSON.stringify({ type, ssh_keys: sshKeys }),
    });
  }

  async disableServerRescue(id: number): Promise<{ action: CloudAction }> {
    return await this.request(`/servers/${id}/actions/disable_rescue`, {
      method: "POST",
    });
  }

  async enableServerBackup(id: number): Promise<{ action: CloudAction }> {
    return await this.request(`/servers/${id}/actions/enable_backup`, {
      method: "POST",
    });
  }

  async disableServerBackup(id: number): Promise<{ action: CloudAction }> {
    return await this.request(`/servers/${id}/actions/disable_backup`, {
      method: "POST",
    });
  }

  async createServerImage(
    id: number,
    opts: {
      description?: string;
      type?: "snapshot" | "backup";
      labels?: Labels;
    }
  ): Promise<{ image: Image; action: CloudAction }> {
    return await this.request(`/servers/${id}/actions/create_image`, {
      method: "POST",
      body: JSON.stringify(opts),
    });
  }

  async attachIsoToServer(
    id: number,
    iso: string
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/servers/${id}/actions/attach_iso`, {
      method: "POST",
      body: JSON.stringify({ iso }),
    });
  }

  async detachIsoFromServer(id: number): Promise<{ action: CloudAction }> {
    return await this.request(`/servers/${id}/actions/detach_iso`, {
      method: "POST",
    });
  }

  async resetServerPassword(
    id: number
  ): Promise<{ action: CloudAction; root_password: string }> {
    return await this.request(`/servers/${id}/actions/reset_password`, {
      method: "POST",
    });
  }

  async setServerRdns(
    id: number,
    ip: string,
    dnsPtr: string
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/servers/${id}/actions/change_dns_ptr`, {
      method: "POST",
      body: JSON.stringify({ ip, dns_ptr: dnsPtr }),
    });
  }

  async enableServerProtection(
    id: number,
    opts: { delete?: boolean; rebuild?: boolean }
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/servers/${id}/actions/change_protection`, {
      method: "POST",
      body: JSON.stringify(opts),
    });
  }

  async requestServerConsole(
    id: number
  ): Promise<{ wss_url: string; password: string; action: CloudAction }> {
    return await this.request(`/servers/${id}/actions/request_console`, {
      method: "POST",
    });
  }

  async attachServerToNetwork(
    id: number,
    network: number,
    ip?: string,
    aliasIps?: string[]
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/servers/${id}/actions/attach_to_network`, {
      method: "POST",
      body: JSON.stringify({ network, ip, alias_ips: aliasIps }),
    });
  }

  async detachServerFromNetwork(
    id: number,
    network: number
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/servers/${id}/actions/detach_from_network`, {
      method: "POST",
      body: JSON.stringify({ network }),
    });
  }

  async addServerToPlacementGroup(
    id: number,
    placementGroup: number
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/servers/${id}/actions/add_to_placement_group`, {
      method: "POST",
      body: JSON.stringify({ placement_group: placementGroup }),
    });
  }

  async removeServerFromPlacementGroup(
    id: number
  ): Promise<{ action: CloudAction }> {
    return await this.request(
      `/servers/${id}/actions/remove_from_placement_group`,
      {
        method: "POST",
      }
    );
  }

  async getServerMetrics(
    id: number,
    type: string,
    start: string,
    end: string
  ): Promise<unknown> {
    const query = this.buildQuery({ type, start, end });
    return await this.request(`/servers/${id}/metrics${query}`);
  }

  // =========================================================================
  // Networks
  // =========================================================================

  async listNetworks(
    params: { label_selector?: string; name?: string } = {}
  ): Promise<Network[]> {
    return await this.listAll<Network>("/networks", "networks", params);
  }

  async getNetwork(id: number): Promise<Network> {
    const { network } = await this.request<{ network: Network }>(
      `/networks/${id}`
    );
    return network;
  }

  async createNetwork(opts: {
    name: string;
    ip_range: string;
    subnets?: Omit<NetworkSubnet, "gateway">[];
    routes?: NetworkRoute[];
    labels?: Labels;
    expose_routes_to_vswitch?: boolean;
  }): Promise<{ network: Network }> {
    return await this.request("/networks", {
      method: "POST",
      body: JSON.stringify(opts),
    });
  }

  async deleteNetwork(id: number): Promise<void> {
    await this.request(`/networks/${id}`, { method: "DELETE" });
  }

  async updateNetwork(
    id: number,
    opts: { name?: string; labels?: Labels; expose_routes_to_vswitch?: boolean }
  ): Promise<{ network: Network }> {
    return await this.request(`/networks/${id}`, {
      method: "PUT",
      body: JSON.stringify(opts),
    });
  }

  async addSubnetToNetwork(
    id: number,
    subnet: Omit<NetworkSubnet, "gateway">
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/networks/${id}/actions/add_subnet`, {
      method: "POST",
      body: JSON.stringify(subnet),
    });
  }

  async deleteSubnetFromNetwork(
    id: number,
    ipRange: string
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/networks/${id}/actions/delete_subnet`, {
      method: "POST",
      body: JSON.stringify({ ip_range: ipRange }),
    });
  }

  async addRouteToNetwork(
    id: number,
    route: NetworkRoute
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/networks/${id}/actions/add_route`, {
      method: "POST",
      body: JSON.stringify(route),
    });
  }

  async deleteRouteFromNetwork(
    id: number,
    route: NetworkRoute
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/networks/${id}/actions/delete_route`, {
      method: "POST",
      body: JSON.stringify(route),
    });
  }

  async changeNetworkIpRange(
    id: number,
    ipRange: string
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/networks/${id}/actions/change_ip_range`, {
      method: "POST",
      body: JSON.stringify({ ip_range: ipRange }),
    });
  }

  async changeNetworkProtection(
    id: number,
    deleteProtection: boolean
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/networks/${id}/actions/change_protection`, {
      method: "POST",
      body: JSON.stringify({ delete: deleteProtection }),
    });
  }

  // =========================================================================
  // Cloud Firewalls
  // =========================================================================

  async listFirewalls(
    params: { label_selector?: string; name?: string; sort?: string } = {}
  ): Promise<CloudFirewall[]> {
    return await this.listAll<CloudFirewall>("/firewalls", "firewalls", params);
  }

  async getFirewall(id: number): Promise<CloudFirewall> {
    const { firewall } = await this.request<{ firewall: CloudFirewall }>(
      `/firewalls/${id}`
    );
    return firewall;
  }

  async createFirewall(opts: {
    name: string;
    rules?: CloudFirewallRule[];
    labels?: Labels;
    apply_to?: CloudFirewallRule[];
  }): Promise<{ firewall: CloudFirewall; actions: CloudAction[] }> {
    return await this.request("/firewalls", {
      method: "POST",
      body: JSON.stringify(opts),
    });
  }

  async deleteFirewall(id: number): Promise<void> {
    await this.request(`/firewalls/${id}`, { method: "DELETE" });
  }

  async updateFirewall(
    id: number,
    opts: { name?: string; labels?: Labels }
  ): Promise<{ firewall: CloudFirewall }> {
    return await this.request(`/firewalls/${id}`, {
      method: "PUT",
      body: JSON.stringify(opts),
    });
  }

  async setFirewallRules(
    id: number,
    rules: CloudFirewallRule[]
  ): Promise<{ actions: CloudAction[] }> {
    return await this.request(`/firewalls/${id}/actions/set_rules`, {
      method: "POST",
      body: JSON.stringify({ rules }),
    });
  }

  async applyFirewall(
    id: number,
    applyTo: {
      type: "server" | "label_selector";
      server?: { id: number };
      label_selector?: { selector: string };
    }[]
  ): Promise<{ actions: CloudAction[] }> {
    return await this.request(`/firewalls/${id}/actions/apply_to_resources`, {
      method: "POST",
      body: JSON.stringify({ apply_to: applyTo }),
    });
  }

  async removeFirewallFromResources(
    id: number,
    removeFrom: {
      type: "server" | "label_selector";
      server?: { id: number };
      label_selector?: { selector: string };
    }[]
  ): Promise<{ actions: CloudAction[] }> {
    return await this.request(
      `/firewalls/${id}/actions/remove_from_resources`,
      {
        method: "POST",
        body: JSON.stringify({ remove_from: removeFrom }),
      }
    );
  }

  // =========================================================================
  // Floating IPs
  // =========================================================================

  async listFloatingIps(
    params: { label_selector?: string; sort?: string; name?: string } = {}
  ): Promise<FloatingIp[]> {
    return await this.listAll<FloatingIp>(
      "/floating_ips",
      "floating_ips",
      params
    );
  }

  async getFloatingIp(id: number): Promise<FloatingIp> {
    const { floating_ip } = await this.request<{ floating_ip: FloatingIp }>(
      `/floating_ips/${id}`
    );
    return floating_ip;
  }

  async createFloatingIp(opts: {
    type: "ipv4" | "ipv6";
    name?: string;
    description?: string;
    home_location?: string;
    server?: number;
    labels?: Labels;
  }): Promise<{ floating_ip: FloatingIp; action: CloudAction }> {
    return await this.request("/floating_ips", {
      method: "POST",
      body: JSON.stringify(opts),
    });
  }

  async deleteFloatingIp(id: number): Promise<void> {
    await this.request(`/floating_ips/${id}`, { method: "DELETE" });
  }

  async updateFloatingIp(
    id: number,
    opts: { name?: string; description?: string; labels?: Labels }
  ): Promise<{ floating_ip: FloatingIp }> {
    return await this.request(`/floating_ips/${id}`, {
      method: "PUT",
      body: JSON.stringify(opts),
    });
  }

  async assignFloatingIp(
    id: number,
    serverId: number
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/floating_ips/${id}/actions/assign`, {
      method: "POST",
      body: JSON.stringify({ server: serverId }),
    });
  }

  async unassignFloatingIp(id: number): Promise<{ action: CloudAction }> {
    return await this.request(`/floating_ips/${id}/actions/unassign`, {
      method: "POST",
    });
  }

  async changeFloatingIpProtection(
    id: number,
    deleteProtection: boolean
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/floating_ips/${id}/actions/change_protection`, {
      method: "POST",
      body: JSON.stringify({ delete: deleteProtection }),
    });
  }

  async changeFloatingIpDnsPtr(
    id: number,
    ip: string,
    dnsPtr: string | null
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/floating_ips/${id}/actions/change_dns_ptr`, {
      method: "POST",
      body: JSON.stringify({ ip, dns_ptr: dnsPtr }),
    });
  }

  // =========================================================================
  // Primary IPs
  // =========================================================================

  async listPrimaryIps(
    params: { label_selector?: string; sort?: string; name?: string } = {}
  ): Promise<PrimaryIp[]> {
    return await this.listAll<PrimaryIp>("/primary_ips", "primary_ips", params);
  }

  async getPrimaryIp(id: number): Promise<PrimaryIp> {
    const { primary_ip } = await this.request<{ primary_ip: PrimaryIp }>(
      `/primary_ips/${id}`
    );
    return primary_ip;
  }

  async createPrimaryIp(opts: {
    type: "ipv4" | "ipv6";
    name: string;
    assignee_type: "server";
    assignee_id?: number;
    location?: string;
    auto_delete?: boolean;
    labels?: Labels;
  }): Promise<{ primary_ip: PrimaryIp; action: CloudAction }> {
    return await this.request("/primary_ips", {
      method: "POST",
      body: JSON.stringify(opts),
    });
  }

  async deletePrimaryIp(id: number): Promise<void> {
    await this.request(`/primary_ips/${id}`, { method: "DELETE" });
  }

  async updatePrimaryIp(
    id: number,
    opts: { name?: string; auto_delete?: boolean; labels?: Labels }
  ): Promise<{ primary_ip: PrimaryIp }> {
    return await this.request(`/primary_ips/${id}`, {
      method: "PUT",
      body: JSON.stringify(opts),
    });
  }

  async assignPrimaryIp(
    id: number,
    assigneeId: number,
    assigneeType = "server"
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/primary_ips/${id}/actions/assign`, {
      method: "POST",
      body: JSON.stringify({
        assignee_id: assigneeId,
        assignee_type: assigneeType,
      }),
    });
  }

  async unassignPrimaryIp(id: number): Promise<{ action: CloudAction }> {
    return await this.request(`/primary_ips/${id}/actions/unassign`, {
      method: "POST",
    });
  }

  async changePrimaryIpProtection(
    id: number,
    deleteProtection: boolean
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/primary_ips/${id}/actions/change_protection`, {
      method: "POST",
      body: JSON.stringify({ delete: deleteProtection }),
    });
  }

  async changePrimaryIpDnsPtr(
    id: number,
    ip: string,
    dnsPtr: string | null
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/primary_ips/${id}/actions/change_dns_ptr`, {
      method: "POST",
      body: JSON.stringify({ ip, dns_ptr: dnsPtr }),
    });
  }

  // =========================================================================
  // Volumes
  // =========================================================================

  async listVolumes(
    params: {
      label_selector?: string;
      sort?: string;
      name?: string;
      status?: string;
    } = {}
  ): Promise<Volume[]> {
    return await this.listAll<Volume>("/volumes", "volumes", params);
  }

  async getVolume(id: number): Promise<Volume> {
    const { volume } = await this.request<{ volume: Volume }>(`/volumes/${id}`);
    return volume;
  }

  async createVolume(opts: {
    name: string;
    size: number;
    location?: string;
    server?: number;
    format?: string;
    automount?: boolean;
    labels?: Labels;
  }): Promise<{
    volume: Volume;
    action: CloudAction;
    next_actions: CloudAction[];
  }> {
    return await this.request("/volumes", {
      method: "POST",
      body: JSON.stringify(opts),
    });
  }

  async deleteVolume(id: number): Promise<void> {
    await this.request(`/volumes/${id}`, { method: "DELETE" });
  }

  async updateVolume(
    id: number,
    opts: { name?: string; labels?: Labels }
  ): Promise<{ volume: Volume }> {
    return await this.request(`/volumes/${id}`, {
      method: "PUT",
      body: JSON.stringify(opts),
    });
  }

  async attachVolume(
    id: number,
    serverId: number,
    automount?: boolean
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/volumes/${id}/actions/attach`, {
      method: "POST",
      body: JSON.stringify({ server: serverId, automount }),
    });
  }

  async detachVolume(id: number): Promise<{ action: CloudAction }> {
    return await this.request(`/volumes/${id}/actions/detach`, {
      method: "POST",
    });
  }

  async resizeVolume(
    id: number,
    size: number
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/volumes/${id}/actions/resize`, {
      method: "POST",
      body: JSON.stringify({ size }),
    });
  }

  async changeVolumeProtection(
    id: number,
    deleteProtection: boolean
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/volumes/${id}/actions/change_protection`, {
      method: "POST",
      body: JSON.stringify({ delete: deleteProtection }),
    });
  }

  // =========================================================================
  // Load Balancers
  // =========================================================================

  async listLoadBalancers(
    params: { label_selector?: string; sort?: string; name?: string } = {}
  ): Promise<LoadBalancer[]> {
    return await this.listAll<LoadBalancer>(
      "/load_balancers",
      "load_balancers",
      params
    );
  }

  async getLoadBalancer(id: number): Promise<LoadBalancer> {
    const { load_balancer } = await this.request<{
      load_balancer: LoadBalancer;
    }>(`/load_balancers/${id}`);
    return load_balancer;
  }

  async createLoadBalancer(opts: {
    name: string;
    load_balancer_type: string;
    location?: string;
    network_zone?: string;
    algorithm?: { type: string };
    services?: unknown[];
    targets?: unknown[];
    labels?: Labels;
    network?: number;
    public_interface?: boolean;
  }): Promise<{ load_balancer: LoadBalancer; action: CloudAction }> {
    return await this.request("/load_balancers", {
      method: "POST",
      body: JSON.stringify(opts),
    });
  }

  async deleteLoadBalancer(id: number): Promise<void> {
    await this.request(`/load_balancers/${id}`, { method: "DELETE" });
  }

  async updateLoadBalancer(
    id: number,
    opts: { name?: string; labels?: Labels }
  ): Promise<{ load_balancer: LoadBalancer }> {
    return await this.request(`/load_balancers/${id}`, {
      method: "PUT",
      body: JSON.stringify(opts),
    });
  }

  async addTargetToLoadBalancer(
    id: number,
    target: unknown
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/load_balancers/${id}/actions/add_target`, {
      method: "POST",
      body: JSON.stringify(target),
    });
  }

  async removeTargetFromLoadBalancer(
    id: number,
    target: unknown
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/load_balancers/${id}/actions/remove_target`, {
      method: "POST",
      body: JSON.stringify(target),
    });
  }

  async addServiceToLoadBalancer(
    id: number,
    service: unknown
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/load_balancers/${id}/actions/add_service`, {
      method: "POST",
      body: JSON.stringify(service),
    });
  }

  async updateServiceOnLoadBalancer(
    id: number,
    service: unknown
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/load_balancers/${id}/actions/update_service`, {
      method: "POST",
      body: JSON.stringify(service),
    });
  }

  async deleteServiceFromLoadBalancer(
    id: number,
    listenPort: number
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/load_balancers/${id}/actions/delete_service`, {
      method: "POST",
      body: JSON.stringify({ listen_port: listenPort }),
    });
  }

  async changeLoadBalancerAlgorithm(
    id: number,
    type: string
  ): Promise<{ action: CloudAction }> {
    return await this.request(
      `/load_balancers/${id}/actions/change_algorithm`,
      {
        method: "POST",
        body: JSON.stringify({ type }),
      }
    );
  }

  async changeLoadBalancerType(
    id: number,
    loadBalancerType: string
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/load_balancers/${id}/actions/change_type`, {
      method: "POST",
      body: JSON.stringify({ load_balancer_type: loadBalancerType }),
    });
  }

  async attachLoadBalancerToNetwork(
    id: number,
    network: number,
    ip?: string
  ): Promise<{ action: CloudAction }> {
    return await this.request(
      `/load_balancers/${id}/actions/attach_to_network`,
      {
        method: "POST",
        body: JSON.stringify({ network, ip }),
      }
    );
  }

  async detachLoadBalancerFromNetwork(
    id: number,
    network: number
  ): Promise<{ action: CloudAction }> {
    return await this.request(
      `/load_balancers/${id}/actions/detach_from_network`,
      {
        method: "POST",
        body: JSON.stringify({ network }),
      }
    );
  }

  async enableLoadBalancerPublicInterface(
    id: number
  ): Promise<{ action: CloudAction }> {
    return await this.request(
      `/load_balancers/${id}/actions/enable_public_interface`,
      { method: "POST" }
    );
  }

  async disableLoadBalancerPublicInterface(
    id: number
  ): Promise<{ action: CloudAction }> {
    return await this.request(
      `/load_balancers/${id}/actions/disable_public_interface`,
      { method: "POST" }
    );
  }

  async changeLoadBalancerProtection(
    id: number,
    deleteProtection: boolean
  ): Promise<{ action: CloudAction }> {
    return await this.request(
      `/load_balancers/${id}/actions/change_protection`,
      {
        method: "POST",
        body: JSON.stringify({ delete: deleteProtection }),
      }
    );
  }

  // =========================================================================
  // Images
  // =========================================================================

  async listImages(
    params: {
      label_selector?: string;
      sort?: string;
      type?: string;
      architecture?: string;
      name?: string;
      status?: string;
    } = {}
  ): Promise<Image[]> {
    return await this.listAll<Image>("/images", "images", params);
  }

  async getImage(id: number): Promise<Image> {
    const { image } = await this.request<{ image: Image }>(`/images/${id}`);
    return image;
  }

  async updateImage(
    id: number,
    opts: { description?: string; type?: string; labels?: Labels }
  ): Promise<{ image: Image }> {
    return await this.request(`/images/${id}`, {
      method: "PUT",
      body: JSON.stringify(opts),
    });
  }

  async deleteImage(id: number): Promise<void> {
    await this.request(`/images/${id}`, { method: "DELETE" });
  }

  async changeImageProtection(
    id: number,
    deleteProtection: boolean
  ): Promise<{ action: CloudAction }> {
    return await this.request(`/images/${id}/actions/change_protection`, {
      method: "POST",
      body: JSON.stringify({ delete: deleteProtection }),
    });
  }

  // =========================================================================
  // SSH Keys (Cloud)
  // =========================================================================

  async listSshKeys(
    params: {
      label_selector?: string;
      sort?: string;
      name?: string;
      fingerprint?: string;
    } = {}
  ): Promise<CloudSshKey[]> {
    return await this.listAll<CloudSshKey>("/ssh_keys", "ssh_keys", params);
  }

  async getSshKey(id: number): Promise<CloudSshKey> {
    const { ssh_key } = await this.request<{ ssh_key: CloudSshKey }>(
      `/ssh_keys/${id}`
    );
    return ssh_key;
  }

  async createSshKey(opts: {
    name: string;
    public_key: string;
    labels?: Labels;
  }): Promise<{ ssh_key: CloudSshKey }> {
    return await this.request("/ssh_keys", {
      method: "POST",
      body: JSON.stringify(opts),
    });
  }

  async updateSshKey(
    id: number,
    opts: { name?: string; labels?: Labels }
  ): Promise<{ ssh_key: CloudSshKey }> {
    return await this.request(`/ssh_keys/${id}`, {
      method: "PUT",
      body: JSON.stringify(opts),
    });
  }

  async deleteSshKey(id: number): Promise<void> {
    await this.request(`/ssh_keys/${id}`, { method: "DELETE" });
  }

  // =========================================================================
  // Certificates
  // =========================================================================

  async listCertificates(
    params: {
      label_selector?: string;
      sort?: string;
      name?: string;
      type?: string;
    } = {}
  ): Promise<Certificate[]> {
    return await this.listAll<Certificate>(
      "/certificates",
      "certificates",
      params
    );
  }

  async getCertificate(id: number): Promise<Certificate> {
    const { certificate } = await this.request<{ certificate: Certificate }>(
      `/certificates/${id}`
    );
    return certificate;
  }

  async createCertificate(opts: {
    name: string;
    type?: "uploaded" | "managed";
    certificate?: string;
    private_key?: string;
    domain_names?: string[];
    labels?: Labels;
  }): Promise<{ certificate: Certificate; action?: CloudAction }> {
    return await this.request("/certificates", {
      method: "POST",
      body: JSON.stringify(opts),
    });
  }

  async updateCertificate(
    id: number,
    opts: { name?: string; labels?: Labels }
  ): Promise<{ certificate: Certificate }> {
    return await this.request(`/certificates/${id}`, {
      method: "PUT",
      body: JSON.stringify(opts),
    });
  }

  async deleteCertificate(id: number): Promise<void> {
    await this.request(`/certificates/${id}`, { method: "DELETE" });
  }

  // =========================================================================
  // Placement Groups
  // =========================================================================

  async listPlacementGroups(
    params: {
      label_selector?: string;
      sort?: string;
      name?: string;
      type?: string;
    } = {}
  ): Promise<PlacementGroup[]> {
    return await this.listAll<PlacementGroup>(
      "/placement_groups",
      "placement_groups",
      params
    );
  }

  async getPlacementGroup(id: number): Promise<PlacementGroup> {
    const { placement_group } = await this.request<{
      placement_group: PlacementGroup;
    }>(`/placement_groups/${id}`);
    return placement_group;
  }

  async createPlacementGroup(opts: {
    name: string;
    type: "spread";
    labels?: Labels;
  }): Promise<{ placement_group: PlacementGroup }> {
    return await this.request("/placement_groups", {
      method: "POST",
      body: JSON.stringify(opts),
    });
  }

  async updatePlacementGroup(
    id: number,
    opts: { name?: string; labels?: Labels }
  ): Promise<{ placement_group: PlacementGroup }> {
    return await this.request(`/placement_groups/${id}`, {
      method: "PUT",
      body: JSON.stringify(opts),
    });
  }

  async deletePlacementGroup(id: number): Promise<void> {
    await this.request(`/placement_groups/${id}`, { method: "DELETE" });
  }

  // =========================================================================
  // Actions (generic)
  // =========================================================================

  async getAction(id: number): Promise<CloudAction> {
    const { action } = await this.request<{ action: CloudAction }>(
      `/actions/${id}`
    );
    return action;
  }

  async listActions(
    params: { sort?: string; status?: string } = {}
  ): Promise<CloudAction[]> {
    return await this.listAll<CloudAction>("/actions", "actions", params);
  }
}
