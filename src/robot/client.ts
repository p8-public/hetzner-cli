// ============================================================================
// Hetzner Robot API Client
// Base URL: https://robot-ws.your-server.de
// Auth: HTTP Basic Authentication
// ============================================================================

import type {
  BootConfig,
  Cancellation,
  Failover,
  Firewall,
  FirewallRule,
  FirewallTemplate,
  IP,
  LinuxConfig,
  Mac,
  Rdns,
  RescueConfig,
  Reset,
  ResetType,
  Server,
  ServerDetails,
  ServerMarketProduct,
  ServerProduct,
  ServerTransaction,
  SshKey,
  StorageBox,
  StorageBoxSnapshot,
  StorageBoxSnapshotPlan,
  StorageBoxSubaccount,
  Subnet,
  Traffic,
  VncConfig,
  VSwitch,
  VSwitchSummary,
  VSwitchWithServerNames,
  WindowsConfig,
  Wol,
} from "./types.js";

const BASE_URL = "https://robot-ws.your-server.de";

export class HetznerRobotClient {
  private readonly auth: string;

  constructor(username: string, password: string) {
    this.auth = Buffer.from(`${username}:${password}`).toString("base64");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;

    const headers: HeadersInit = {
      Authorization: `Basic ${this.auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
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

    // Handle empty responses (204 No Content, or 200 with empty body)
    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  private encodeParams(
    params: Record<string, string | string[] | boolean | number | undefined>
  ): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const v of value) {
          parts.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(v)}`);
        }
      } else {
        parts.push(
          `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
        );
      }
    }
    return parts.join("&");
  }

  private buildTrafficParams(
    trafficWarnings?: boolean,
    trafficHourly?: number,
    trafficDaily?: number,
    trafficMonthly?: number
  ): Record<string, boolean | number | undefined> {
    return {
      traffic_warnings: trafficWarnings,
      traffic_hourly: trafficHourly,
      traffic_daily: trafficDaily,
      traffic_monthly: trafficMonthly,
    };
  }

  // =========================================================================
  // Server Management
  // =========================================================================

  async listServers(): Promise<{ server: Server }[]> {
    return await this.request<{ server: Server }[]>("/server");
  }

  async getServer(
    serverIpOrNumber: string | number
  ): Promise<{ server: ServerDetails }> {
    return await this.request<{ server: ServerDetails }>(
      `/server/${serverIpOrNumber}`
    );
  }

  async updateServerName(
    serverIpOrNumber: string | number,
    name: string
  ): Promise<{ server: Server }> {
    return await this.request<{ server: Server }>(
      `/server/${serverIpOrNumber}`,
      {
        method: "POST",
        body: this.encodeParams({ server_name: name }),
      }
    );
  }

  // =========================================================================
  // Cancellation
  // =========================================================================

  async getCancellation(
    serverIpOrNumber: string | number
  ): Promise<{ cancellation: Cancellation }> {
    return await this.request<{ cancellation: Cancellation }>(
      `/server/${serverIpOrNumber}/cancellation`
    );
  }

  async cancelServer(
    serverIpOrNumber: string | number,
    cancellationDate?: string,
    cancellationReason?: string[]
  ): Promise<{ cancellation: Cancellation }> {
    const params: Record<string, string | string[] | undefined> = {};
    if (cancellationDate) {
      params.cancellation_date = cancellationDate;
    }
    if (cancellationReason) {
      params.cancellation_reason = cancellationReason;
    }

    return await this.request<{ cancellation: Cancellation }>(
      `/server/${serverIpOrNumber}/cancellation`,
      {
        method: "POST",
        body: this.encodeParams(params),
      }
    );
  }

  async revokeCancellation(serverIpOrNumber: string | number): Promise<void> {
    await this.request<Record<string, never>>(
      `/server/${serverIpOrNumber}/cancellation`,
      {
        method: "DELETE",
      }
    );
  }

  // =========================================================================
  // Reset
  // =========================================================================

  async listResetOptions(): Promise<{ reset: Reset }[]> {
    return await this.request<{ reset: Reset }[]>("/reset");
  }

  async getResetOptions(
    serverIpOrNumber: string | number
  ): Promise<{ reset: Reset }> {
    return await this.request<{ reset: Reset }>(`/reset/${serverIpOrNumber}`);
  }

  async resetServer(
    serverIpOrNumber: string | number,
    type: ResetType = "sw"
  ): Promise<{ reset: Reset }> {
    return await this.request<{ reset: Reset }>(`/reset/${serverIpOrNumber}`, {
      method: "POST",
      body: this.encodeParams({ type }),
    });
  }

  // =========================================================================
  // Boot Configuration
  // =========================================================================

  async getBootConfig(
    serverIpOrNumber: string | number
  ): Promise<{ boot: BootConfig }> {
    return await this.request<{ boot: BootConfig }>(
      `/boot/${serverIpOrNumber}`
    );
  }

  // Rescue System
  async getRescue(
    serverIpOrNumber: string | number
  ): Promise<{ rescue: RescueConfig }> {
    return await this.request<{ rescue: RescueConfig }>(
      `/boot/${serverIpOrNumber}/rescue`
    );
  }

  async activateRescue(
    serverIpOrNumber: string | number,
    os: string,
    arch?: number,
    authorizedKeys?: string[]
  ): Promise<{ rescue: RescueConfig }> {
    const params: Record<string, string | number | string[] | undefined> = {
      os,
    };
    if (arch) {
      params.arch = arch;
    }
    if (authorizedKeys) {
      params.authorized_key = authorizedKeys;
    }

    return await this.request<{ rescue: RescueConfig }>(
      `/boot/${serverIpOrNumber}/rescue`,
      {
        method: "POST",
        body: this.encodeParams(params),
      }
    );
  }

  async deactivateRescue(
    serverIpOrNumber: string | number
  ): Promise<{ rescue: RescueConfig }> {
    return await this.request<{ rescue: RescueConfig }>(
      `/boot/${serverIpOrNumber}/rescue`,
      {
        method: "DELETE",
      }
    );
  }

  async getLastRescue(
    serverIpOrNumber: string | number
  ): Promise<{ rescue: RescueConfig }> {
    return await this.request<{ rescue: RescueConfig }>(
      `/boot/${serverIpOrNumber}/rescue/last`
    );
  }

  // Linux Install
  async getLinux(
    serverIpOrNumber: string | number
  ): Promise<{ linux: LinuxConfig }> {
    return await this.request<{ linux: LinuxConfig }>(
      `/boot/${serverIpOrNumber}/linux`
    );
  }

  async activateLinux(
    serverIpOrNumber: string | number,
    dist: string,
    arch?: number,
    lang?: string,
    authorizedKeys?: string[]
  ): Promise<{ linux: LinuxConfig }> {
    const params: Record<string, string | number | string[] | undefined> = {
      dist,
    };
    if (arch) {
      params.arch = arch;
    }
    if (lang) {
      params.lang = lang;
    }
    if (authorizedKeys) {
      params.authorized_key = authorizedKeys;
    }

    return await this.request<{ linux: LinuxConfig }>(
      `/boot/${serverIpOrNumber}/linux`,
      {
        method: "POST",
        body: this.encodeParams(params),
      }
    );
  }

  async deactivateLinux(
    serverIpOrNumber: string | number
  ): Promise<{ linux: LinuxConfig }> {
    return await this.request<{ linux: LinuxConfig }>(
      `/boot/${serverIpOrNumber}/linux`,
      {
        method: "DELETE",
      }
    );
  }

  async getLastLinux(
    serverIpOrNumber: string | number
  ): Promise<{ linux: LinuxConfig }> {
    return await this.request<{ linux: LinuxConfig }>(
      `/boot/${serverIpOrNumber}/linux/last`
    );
  }

  // VNC Install
  async getVnc(serverIpOrNumber: string | number): Promise<{ vnc: VncConfig }> {
    return await this.request<{ vnc: VncConfig }>(
      `/boot/${serverIpOrNumber}/vnc`
    );
  }

  async activateVnc(
    serverIpOrNumber: string | number,
    dist: string,
    arch?: number,
    lang?: string
  ): Promise<{ vnc: VncConfig }> {
    const params: Record<string, string | number | undefined> = { dist };
    if (arch) {
      params.arch = arch;
    }
    if (lang) {
      params.lang = lang;
    }

    return await this.request<{ vnc: VncConfig }>(
      `/boot/${serverIpOrNumber}/vnc`,
      {
        method: "POST",
        body: this.encodeParams(params),
      }
    );
  }

  async deactivateVnc(
    serverIpOrNumber: string | number
  ): Promise<{ vnc: VncConfig }> {
    return await this.request<{ vnc: VncConfig }>(
      `/boot/${serverIpOrNumber}/vnc`,
      {
        method: "DELETE",
      }
    );
  }

  // Windows Install
  async getWindows(
    serverIpOrNumber: string | number
  ): Promise<{ windows: WindowsConfig }> {
    return await this.request<{ windows: WindowsConfig }>(
      `/boot/${serverIpOrNumber}/windows`
    );
  }

  async activateWindows(
    serverIpOrNumber: string | number,
    dist: string,
    lang?: string
  ): Promise<{ windows: WindowsConfig }> {
    const params: Record<string, string | undefined> = { dist };
    if (lang) {
      params.lang = lang;
    }

    return await this.request<{ windows: WindowsConfig }>(
      `/boot/${serverIpOrNumber}/windows`,
      {
        method: "POST",
        body: this.encodeParams(params),
      }
    );
  }

  async deactivateWindows(
    serverIpOrNumber: string | number
  ): Promise<{ windows: WindowsConfig }> {
    return await this.request<{ windows: WindowsConfig }>(
      `/boot/${serverIpOrNumber}/windows`,
      {
        method: "DELETE",
      }
    );
  }

  // =========================================================================
  // IP Management
  // =========================================================================

  async listIps(): Promise<{ ip: IP }[]> {
    return await this.request<{ ip: IP }[]>("/ip");
  }

  async getIp(ip: string): Promise<{ ip: IP }> {
    return await this.request<{ ip: IP }>(`/ip/${ip}`);
  }

  async updateIp(
    ip: string,
    trafficWarnings?: boolean,
    trafficHourly?: number,
    trafficDaily?: number,
    trafficMonthly?: number
  ): Promise<{ ip: IP }> {
    return await this.request<{ ip: IP }>(`/ip/${ip}`, {
      method: "POST",
      body: this.encodeParams(
        this.buildTrafficParams(
          trafficWarnings,
          trafficHourly,
          trafficDaily,
          trafficMonthly
        )
      ),
    });
  }

  async getIpMac(ip: string): Promise<{ mac: Mac }> {
    return await this.request<{ mac: Mac }>(`/ip/${ip}/mac`);
  }

  async generateIpMac(ip: string): Promise<{ mac: Mac }> {
    return await this.request<{ mac: Mac }>(`/ip/${ip}/mac`, {
      method: "PUT",
    });
  }

  async deleteIpMac(ip: string): Promise<void> {
    await this.request<Record<string, never>>(`/ip/${ip}/mac`, {
      method: "DELETE",
    });
  }

  // =========================================================================
  // Subnet Management
  // =========================================================================

  async listSubnets(): Promise<{ subnet: Subnet }[]> {
    return await this.request<{ subnet: Subnet }[]>("/subnet");
  }

  async getSubnet(netIp: string): Promise<{ subnet: Subnet }> {
    return await this.request<{ subnet: Subnet }>(`/subnet/${netIp}`);
  }

  async updateSubnet(
    netIp: string,
    trafficWarnings?: boolean,
    trafficHourly?: number,
    trafficDaily?: number,
    trafficMonthly?: number
  ): Promise<{ subnet: Subnet }> {
    return await this.request<{ subnet: Subnet }>(`/subnet/${netIp}`, {
      method: "POST",
      body: this.encodeParams(
        this.buildTrafficParams(
          trafficWarnings,
          trafficHourly,
          trafficDaily,
          trafficMonthly
        )
      ),
    });
  }

  async getSubnetMac(netIp: string): Promise<{ mac: Mac }> {
    return await this.request<{ mac: Mac }>(`/subnet/${netIp}/mac`);
  }

  async generateSubnetMac(netIp: string): Promise<{ mac: Mac }> {
    return await this.request<{ mac: Mac }>(`/subnet/${netIp}/mac`, {
      method: "PUT",
    });
  }

  async deleteSubnetMac(netIp: string): Promise<void> {
    await this.request<Record<string, never>>(`/subnet/${netIp}/mac`, {
      method: "DELETE",
    });
  }

  // =========================================================================
  // Failover
  // =========================================================================

  async listFailovers(): Promise<{ failover: Failover }[]> {
    return await this.request<{ failover: Failover }[]>("/failover");
  }

  async getFailover(failoverIp: string): Promise<{ failover: Failover }> {
    return await this.request<{ failover: Failover }>(
      `/failover/${failoverIp}`
    );
  }

  async switchFailover(
    failoverIp: string,
    activeServerIp: string
  ): Promise<{ failover: Failover }> {
    return await this.request<{ failover: Failover }>(
      `/failover/${failoverIp}`,
      {
        method: "POST",
        body: this.encodeParams({ active_server_ip: activeServerIp }),
      }
    );
  }

  async deleteFailoverRouting(failoverIp: string): Promise<void> {
    await this.request<Record<string, never>>(`/failover/${failoverIp}`, {
      method: "DELETE",
    });
  }

  // =========================================================================
  // Reverse DNS
  // =========================================================================

  async listRdns(): Promise<{ rdns: Rdns }[]> {
    return await this.request<{ rdns: Rdns }[]>("/rdns");
  }

  async getRdns(ip: string): Promise<{ rdns: Rdns }> {
    return await this.request<{ rdns: Rdns }>(`/rdns/${ip}`);
  }

  async createRdns(ip: string, ptr: string): Promise<{ rdns: Rdns }> {
    return await this.request<{ rdns: Rdns }>(`/rdns/${ip}`, {
      method: "PUT",
      body: this.encodeParams({ ptr }),
    });
  }

  async updateRdns(ip: string, ptr: string): Promise<{ rdns: Rdns }> {
    return await this.request<{ rdns: Rdns }>(`/rdns/${ip}`, {
      method: "POST",
      body: this.encodeParams({ ptr }),
    });
  }

  async deleteRdns(ip: string): Promise<void> {
    await this.request<Record<string, never>>(`/rdns/${ip}`, {
      method: "DELETE",
    });
  }

  // =========================================================================
  // SSH Keys
  // =========================================================================

  async listSshKeys(): Promise<{ key: SshKey }[]> {
    return await this.request<{ key: SshKey }[]>("/key");
  }

  async getSshKey(fingerprint: string): Promise<{ key: SshKey }> {
    return await this.request<{ key: SshKey }>(`/key/${fingerprint}`);
  }

  async createSshKey(name: string, data: string): Promise<{ key: SshKey }> {
    return await this.request<{ key: SshKey }>("/key", {
      method: "POST",
      body: this.encodeParams({ name, data }),
    });
  }

  async updateSshKey(
    fingerprint: string,
    name: string
  ): Promise<{ key: SshKey }> {
    return await this.request<{ key: SshKey }>(`/key/${fingerprint}`, {
      method: "POST",
      body: this.encodeParams({ name }),
    });
  }

  async deleteSshKey(fingerprint: string): Promise<void> {
    await this.request<Record<string, never>>(`/key/${fingerprint}`, {
      method: "DELETE",
    });
  }

  // =========================================================================
  // Firewall
  // =========================================================================

  async getFirewall(
    serverIpOrNumber: string | number
  ): Promise<{ firewall: Firewall }> {
    return await this.request<{ firewall: Firewall }>(
      `/firewall/${serverIpOrNumber}`
    );
  }

  async updateFirewall(
    serverIpOrNumber: string | number,
    status: "active" | "disabled",
    rules?: { input: FirewallRule[] }
  ): Promise<{ firewall: Firewall }> {
    const params: Record<string, string> = { status };
    if (rules) {
      params["rules[input]"] = JSON.stringify(rules.input);
    }

    return await this.request<{ firewall: Firewall }>(
      `/firewall/${serverIpOrNumber}`,
      {
        method: "POST",
        body: this.encodeParams(params),
      }
    );
  }

  async deleteFirewall(serverIpOrNumber: string | number): Promise<void> {
    await this.request<Record<string, never>>(`/firewall/${serverIpOrNumber}`, {
      method: "DELETE",
    });
  }

  // Firewall Templates
  async listFirewallTemplates(): Promise<
    { firewall_template: FirewallTemplate }[]
  > {
    return await this.request<{ firewall_template: FirewallTemplate }[]>(
      "/firewall/template"
    );
  }

  async getFirewallTemplate(
    templateId: number
  ): Promise<{ firewall_template: FirewallTemplate }> {
    return await this.request<{ firewall_template: FirewallTemplate }>(
      `/firewall/template/${templateId}`
    );
  }

  async createFirewallTemplate(
    name: string,
    filterIpv6?: boolean,
    whitelistHos?: boolean,
    isDefault?: boolean,
    rules?: { input: FirewallRule[] }
  ): Promise<{ firewall_template: FirewallTemplate }> {
    const params: Record<string, string | boolean | undefined> = { name };
    if (filterIpv6 !== undefined) {
      params.filter_ipv6 = filterIpv6;
    }
    if (whitelistHos !== undefined) {
      params.whitelist_hos = whitelistHos;
    }
    if (isDefault !== undefined) {
      params.is_default = isDefault;
    }
    if (rules) {
      params["rules[input]"] = JSON.stringify(rules.input);
    }

    return await this.request<{ firewall_template: FirewallTemplate }>(
      "/firewall/template",
      {
        method: "POST",
        body: this.encodeParams(params),
      }
    );
  }

  async updateFirewallTemplate(
    templateId: number,
    name?: string,
    filterIpv6?: boolean,
    whitelistHos?: boolean,
    isDefault?: boolean,
    rules?: { input: FirewallRule[] }
  ): Promise<{ firewall_template: FirewallTemplate }> {
    const params: Record<string, string | boolean | undefined> = {};
    if (name) {
      params.name = name;
    }
    if (filterIpv6 !== undefined) {
      params.filter_ipv6 = filterIpv6;
    }
    if (whitelistHos !== undefined) {
      params.whitelist_hos = whitelistHos;
    }
    if (isDefault !== undefined) {
      params.is_default = isDefault;
    }
    if (rules) {
      params["rules[input]"] = JSON.stringify(rules.input);
    }

    return await this.request<{ firewall_template: FirewallTemplate }>(
      `/firewall/template/${templateId}`,
      {
        method: "POST",
        body: this.encodeParams(params),
      }
    );
  }

  async deleteFirewallTemplate(templateId: number): Promise<void> {
    await this.request<Record<string, never>>(
      `/firewall/template/${templateId}`,
      {
        method: "DELETE",
      }
    );
  }

  // =========================================================================
  // vSwitch
  // =========================================================================

  async listVSwitches(): Promise<VSwitchSummary[]> {
    return await this.request<VSwitchSummary[]>("/vswitch");
  }

  async getVSwitch(id: number): Promise<VSwitch> {
    return await this.request<VSwitch>(`/vswitch/${id}`);
  }

  /**
   * Fetch full details for every vSwitch. The list endpoint omits servers, so
   * this makes one extra request per vSwitch.
   */
  async listVSwitchesWithServers(): Promise<VSwitch[]> {
    const vswitches = await this.listVSwitches();
    return await Promise.all(vswitches.map(({ id }) => this.getVSwitch(id)));
  }

  /**
   * Add server names, which vSwitch responses do not include. Costs one server
   * list request, skipped when no server is attached.
   */
  async addVSwitchServerNames(
    vswitches: VSwitch[]
  ): Promise<VSwitchWithServerNames[]> {
    const hasServers = vswitches.some(({ server }) => server.length > 0);
    const servers = hasServers ? await this.listServers() : [];
    const names = new Map(
      servers
        .filter(({ server }) => server.server_name.length > 0)
        .map(({ server }) => [server.server_number, server.server_name])
    );

    return vswitches.map((vswitch) => ({
      ...vswitch,
      server: vswitch.server.map((srv) => ({
        ...srv,
        server_name: names.get(srv.server_number) ?? null,
      })),
    }));
  }

  async createVSwitch(name: string, vlan: number): Promise<VSwitch> {
    return await this.request<VSwitch>("/vswitch", {
      method: "POST",
      body: this.encodeParams({ name, vlan }),
    });
  }

  async updateVSwitch(id: number, name?: string, vlan?: number): Promise<void> {
    const params: Record<string, string | number | undefined> = {};
    if (name) {
      params.name = name;
    }
    if (vlan !== undefined) {
      params.vlan = vlan;
    }

    await this.request<Record<string, never>>(`/vswitch/${id}`, {
      method: "POST",
      body: this.encodeParams(params),
    });
  }

  async deleteVSwitch(id: number, cancellationDate?: string): Promise<void> {
    const params: Record<string, string | undefined> = {};
    if (cancellationDate) {
      params.cancellation_date = cancellationDate;
    }

    await this.request<Record<string, never>>(`/vswitch/${id}`, {
      method: "DELETE",
      body: this.encodeParams(params),
    });
  }

  async addServerToVSwitch(
    vswitchId: number,
    serverIpOrNumber: string | number
  ): Promise<void> {
    await this.request<Record<string, never>>(`/vswitch/${vswitchId}/server`, {
      method: "POST",
      body: this.encodeParams({ server: String(serverIpOrNumber) }),
    });
  }

  async removeServerFromVSwitch(
    vswitchId: number,
    serverIpOrNumber: string | number
  ): Promise<void> {
    await this.request<Record<string, never>>(`/vswitch/${vswitchId}/server`, {
      method: "DELETE",
      body: this.encodeParams({ server: String(serverIpOrNumber) }),
    });
  }

  // =========================================================================
  // Storage Box
  // =========================================================================

  async listStorageBoxes(): Promise<{ storagebox: StorageBox }[]> {
    return await this.request<{ storagebox: StorageBox }[]>("/storagebox");
  }

  async getStorageBox(id: number): Promise<{ storagebox: StorageBox }> {
    return await this.request<{ storagebox: StorageBox }>(`/storagebox/${id}`);
  }

  async updateStorageBox(
    id: number,
    name?: string,
    webdav?: boolean,
    samba?: boolean,
    ssh?: boolean,
    externalReachability?: boolean,
    zfs?: boolean
  ): Promise<{ storagebox: StorageBox }> {
    const params: Record<string, string | boolean | undefined> = {};
    if (name) {
      params.storagebox_name = name;
    }
    if (webdav !== undefined) {
      params.webdav = webdav;
    }
    if (samba !== undefined) {
      params.samba = samba;
    }
    if (ssh !== undefined) {
      params.ssh = ssh;
    }
    if (externalReachability !== undefined) {
      params.external_reachability = externalReachability;
    }
    if (zfs !== undefined) {
      params.zfs = zfs;
    }

    return await this.request<{ storagebox: StorageBox }>(`/storagebox/${id}`, {
      method: "POST",
      body: this.encodeParams(params),
    });
  }

  async resetStorageBoxPassword(id: number): Promise<{ password: string }> {
    return await this.request<{ password: string }>(
      `/storagebox/${id}/password`,
      {
        method: "POST",
      }
    );
  }

  // Snapshots
  async listStorageBoxSnapshots(
    id: number
  ): Promise<{ snapshot: StorageBoxSnapshot }[]> {
    return await this.request<{ snapshot: StorageBoxSnapshot }[]>(
      `/storagebox/${id}/snapshot`
    );
  }

  async createStorageBoxSnapshot(
    id: number
  ): Promise<{ snapshot: StorageBoxSnapshot }> {
    return await this.request<{ snapshot: StorageBoxSnapshot }>(
      `/storagebox/${id}/snapshot`,
      {
        method: "POST",
      }
    );
  }

  async deleteStorageBoxSnapshot(
    id: number,
    snapshotName: string
  ): Promise<void> {
    await this.request<Record<string, never>>(
      `/storagebox/${id}/snapshot/${snapshotName}`,
      {
        method: "DELETE",
      }
    );
  }

  async revertStorageBoxSnapshot(
    id: number,
    snapshotName: string
  ): Promise<void> {
    await this.request<Record<string, never>>(
      `/storagebox/${id}/snapshot/${snapshotName}/revert`,
      {
        method: "POST",
      }
    );
  }

  // Snapshot Plan
  async getStorageBoxSnapshotPlan(
    id: number
  ): Promise<{ snapshotplan: StorageBoxSnapshotPlan }> {
    return await this.request<{ snapshotplan: StorageBoxSnapshotPlan }>(
      `/storagebox/${id}/snapshotplan`
    );
  }

  async updateStorageBoxSnapshotPlan(
    id: number,
    status: "enabled" | "disabled",
    minute?: number,
    hour?: number,
    dayOfWeek?: number,
    dayOfMonth?: number,
    maxSnapshots?: number
  ): Promise<{ snapshotplan: StorageBoxSnapshotPlan }> {
    const params: Record<string, string | number | undefined> = { status };
    if (minute !== undefined) {
      params.minute = minute;
    }
    if (hour !== undefined) {
      params.hour = hour;
    }
    if (dayOfWeek !== undefined) {
      params.day_of_week = dayOfWeek;
    }
    if (dayOfMonth !== undefined) {
      params.day_of_month = dayOfMonth;
    }
    if (maxSnapshots !== undefined) {
      params.max_snapshots = maxSnapshots;
    }

    return await this.request<{ snapshotplan: StorageBoxSnapshotPlan }>(
      `/storagebox/${id}/snapshotplan`,
      {
        method: "POST",
        body: this.encodeParams(params),
      }
    );
  }

  // Subaccounts
  async listStorageBoxSubaccounts(
    id: number
  ): Promise<{ subaccount: StorageBoxSubaccount }[]> {
    return await this.request<{ subaccount: StorageBoxSubaccount }[]>(
      `/storagebox/${id}/subaccount`
    );
  }

  async createStorageBoxSubaccount(
    id: number,
    homedirectory: string,
    samba?: boolean,
    ssh?: boolean,
    externalReachability?: boolean,
    webdav?: boolean,
    readonly?: boolean,
    comment?: string
  ): Promise<{ subaccount: StorageBoxSubaccount }> {
    const params: Record<string, string | boolean | undefined> = {
      homedirectory,
    };
    if (samba !== undefined) {
      params.samba = samba;
    }
    if (ssh !== undefined) {
      params.ssh = ssh;
    }
    if (externalReachability !== undefined) {
      params.external_reachability = externalReachability;
    }
    if (webdav !== undefined) {
      params.webdav = webdav;
    }
    if (readonly !== undefined) {
      params.readonly = readonly;
    }
    if (comment) {
      params.comment = comment;
    }

    return await this.request<{ subaccount: StorageBoxSubaccount }>(
      `/storagebox/${id}/subaccount`,
      {
        method: "POST",
        body: this.encodeParams(params),
      }
    );
  }

  async updateStorageBoxSubaccount(
    id: number,
    username: string,
    samba?: boolean,
    ssh?: boolean,
    externalReachability?: boolean,
    webdav?: boolean,
    readonly?: boolean,
    comment?: string
  ): Promise<{ subaccount: StorageBoxSubaccount }> {
    const params: Record<string, string | boolean | undefined> = {};
    if (samba !== undefined) {
      params.samba = samba;
    }
    if (ssh !== undefined) {
      params.ssh = ssh;
    }
    if (externalReachability !== undefined) {
      params.external_reachability = externalReachability;
    }
    if (webdav !== undefined) {
      params.webdav = webdav;
    }
    if (readonly !== undefined) {
      params.readonly = readonly;
    }
    if (comment !== undefined) {
      params.comment = comment;
    }

    return await this.request<{ subaccount: StorageBoxSubaccount }>(
      `/storagebox/${id}/subaccount/${username}`,
      {
        method: "PUT",
        body: this.encodeParams(params),
      }
    );
  }

  async deleteStorageBoxSubaccount(
    id: number,
    username: string
  ): Promise<void> {
    await this.request<Record<string, never>>(
      `/storagebox/${id}/subaccount/${username}`,
      {
        method: "DELETE",
      }
    );
  }

  async resetStorageBoxSubaccountPassword(
    id: number,
    username: string
  ): Promise<{ password: string }> {
    return await this.request<{ password: string }>(
      `/storagebox/${id}/subaccount/${username}/password`,
      {
        method: "POST",
      }
    );
  }

  // =========================================================================
  // Traffic
  // =========================================================================

  async getTraffic(
    ips: string[],
    subnets: string[],
    from: string,
    to: string,
    type: "day" | "month" | "year" = "month"
  ): Promise<{ traffic: Traffic }> {
    const params: Record<string, string | string[]> = {
      type,
      from,
      to,
    };
    if (ips.length > 0) {
      params.ip = ips;
    }
    if (subnets.length > 0) {
      params.subnet = subnets;
    }

    return await this.request<{ traffic: Traffic }>("/traffic", {
      method: "POST",
      body: this.encodeParams(params),
    });
  }

  // =========================================================================
  // Wake on LAN
  // =========================================================================

  async getWol(serverIpOrNumber: string | number): Promise<{ wol: Wol }> {
    return await this.request<{ wol: Wol }>(`/wol/${serverIpOrNumber}`);
  }

  async sendWol(serverIpOrNumber: string | number): Promise<{ wol: Wol }> {
    return await this.request<{ wol: Wol }>(`/wol/${serverIpOrNumber}`, {
      method: "POST",
    });
  }

  // =========================================================================
  // Server Ordering
  // =========================================================================

  async listServerProducts(): Promise<{ product: ServerProduct }[]> {
    return await this.request<{ product: ServerProduct }[]>(
      "/order/server/product"
    );
  }

  async listServerMarketProducts(): Promise<
    { product: ServerMarketProduct }[]
  > {
    return await this.request<{ product: ServerMarketProduct }[]>(
      "/order/server_market/product"
    );
  }

  async listServerTransactions(): Promise<
    { transaction: ServerTransaction }[]
  > {
    return await this.request<{ transaction: ServerTransaction }[]>(
      "/order/server/transaction"
    );
  }

  async getServerTransaction(
    transactionId: string
  ): Promise<{ transaction: ServerTransaction }> {
    return await this.request<{ transaction: ServerTransaction }>(
      `/order/server/transaction/${transactionId}`
    );
  }

  async orderServer(
    productId: string,
    authorizedKeys?: string[],
    password?: string,
    dist?: string,
    arch?: number,
    lang?: string,
    location?: string,
    addons?: string[],
    test?: boolean
  ): Promise<{ transaction: ServerTransaction }> {
    const params = this.buildOrderParams(
      productId,
      authorizedKeys,
      password,
      dist,
      arch,
      lang,
      addons,
      test
    );
    if (location) {
      params.location = location;
    }

    return await this.request<{ transaction: ServerTransaction }>(
      "/order/server/transaction",
      {
        method: "POST",
        body: this.encodeParams(params),
      }
    );
  }

  async orderServerMarket(
    productId: number,
    authorizedKeys?: string[],
    password?: string,
    dist?: string,
    arch?: number,
    lang?: string,
    addons?: string[],
    test?: boolean
  ): Promise<{ transaction: ServerTransaction }> {
    const params = this.buildOrderParams(
      productId,
      authorizedKeys,
      password,
      dist,
      arch,
      lang,
      addons,
      test
    );

    return await this.request<{ transaction: ServerTransaction }>(
      "/order/server_market/transaction",
      {
        method: "POST",
        body: this.encodeParams(params),
      }
    );
  }

  private buildOrderParams(
    productId: string | number,
    authorizedKeys?: string[],
    password?: string,
    dist?: string,
    arch?: number,
    lang?: string,
    addons?: string[],
    test?: boolean
  ): Record<string, string | number | string[] | boolean | undefined> {
    const params: Record<
      string,
      string | number | string[] | boolean | undefined
    > = {
      product_id: productId,
    };
    if (authorizedKeys) {
      params.authorized_key = authorizedKeys;
    }
    if (password) {
      params.password = password;
    }
    if (dist) {
      params.dist = dist;
    }
    if (arch) {
      params.arch = arch;
    }
    if (lang) {
      params.lang = lang;
    }
    if (addons) {
      params.addon = addons;
    }
    if (test !== undefined) {
      params.test = test;
    }
    return params;
  }
}
