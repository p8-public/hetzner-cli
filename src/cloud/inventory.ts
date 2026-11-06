import type { HetznerCloudClient } from "./client.js";
import {
  backupMonthly,
  floatingIpMonthly,
  imageMonthly,
  loadBalancerTypeMonthly,
  primaryIpMonthly,
  roundCost,
  serverTypeMonthly,
  volumeMonthly,
} from "./pricing.js";
import type {
  Certificate,
  CloudFirewall,
  CloudPricing,
  CloudServer,
  CloudSshKey,
  FloatingIp,
  Image,
  LoadBalancer,
  Network,
  PlacementGroup,
  PrimaryIp,
  Volume,
} from "./types.js";

/**
 * Fleet inventory with list-price cost estimates.
 *
 * Hetzner has no billing API (verified 2026-10-09: /billing, /invoices,
 * /costs all 404 on the Cloud API; Robot invoices live only in the web
 * console), so costs here are estimates: current list prices (GET /pricing)
 * times live inventory. Dedicated (Robot) servers are out of scope for
 * costing — their price is contract-specific and not exposed via any API.
 */

function primaryIpAssignee(ip: PrimaryIp): string | null {
  if (ip.assignee_type === "server") {
    return `server ${ip.assignee_id}`;
  }
  if (ip.assignee_type === "load_balancer") {
    return `load balancer ${ip.assignee_id}`;
  }
  return null;
}

export interface InventoryServerEntry {
  backup: boolean;
  created: string;
  id: number;
  ipv4: string | null;
  ipv6: string | null;
  location: string;
  monthly: number | null;
  name: string;
  primaryDiskGb: number;
  status: string;
  type: string | null;
  volumeGb: number;
  volumes: number;
  warnings: string[];
}

export interface InventoryVolumeEntry {
  attachedTo: number | null;
  id: number;
  location: string;
  monthly: number | null;
  name: string;
  sizeGb: number;
  status: string;
  warnings: string[];
}

export interface InventoryIpEntry {
  assignedTo: string | null;
  id: number;
  ip: string;
  kind: "primary" | "floating";
  location: string;
  monthly: number | null;
  type: "ipv4" | "ipv6";
  warnings: string[];
}

export interface InventoryLoadBalancerEntry {
  id: number;
  location: string;
  monthly: number | null;
  name: string;
  publicIpv4: string | null;
  targets: number;
  type: string | null;
  warnings: string[];
}

export interface InventoryImageEntry {
  boundTo: number | null;
  id: number;
  monthly: number | null;
  name: string | null;
  sizeGb: number;
  type: string;
  warnings: string[];
}

export interface InventoryReport {
  counts: {
    networks: number;
    firewalls: number;
    certificates: number;
    sshKeys: number;
    placementGroups: number;
  };
  currency: string;
  generatedAt: string;
  images: InventoryImageEntry[];
  ips: InventoryIpEntry[];
  loadBalancers: InventoryLoadBalancerEntry[];
  note: string;
  servers: InventoryServerEntry[];
  totals: {
    monthly: number | null;
    servers: number | null;
    volumes: number | null;
    ips: number | null;
    loadBalancers: number | null;
    images: number | null;
  };
  vatRate: string;
  volumes: InventoryVolumeEntry[];
  warnings: string[];
}

function sumNullable(values: (number | null)[]): number | null {
  let total = 0;
  let seen = false;
  for (const v of values) {
    if (v !== null) {
      total += v;
      seen = true;
    }
  }
  return seen ? roundCost(total) : null;
}

export async function buildInventory(
  client: HetznerCloudClient
): Promise<InventoryReport> {
  const pricing: CloudPricing = await client.getPricing();
  const [
    servers,
    volumes,
    floatingIps,
    primaryIps,
    loadBalancers,
    images,
    networks,
    firewalls,
    certificates,
    sshKeys,
    placementGroups,
  ] = await Promise.all([
    client.listServers(),
    client.listVolumes(),
    client.listFloatingIps(),
    client.listPrimaryIps(),
    client.listLoadBalancers(),
    client.listImages({}),
    client.listNetworks(),
    client.listFirewalls(),
    client.listCertificates(),
    client.listSshKeys(),
    client.listPlacementGroups(),
  ]);
  return assembleReport(pricing, {
    servers,
    volumes,
    floatingIps,
    primaryIps,
    loadBalancers,
    images,
    networks,
    firewalls,
    certificates,
    sshKeys,
    placementGroups,
  });
}

interface RawInventory {
  certificates: Certificate[];
  firewalls: CloudFirewall[];
  floatingIps: FloatingIp[];
  images: Image[];
  loadBalancers: LoadBalancer[];
  networks: Network[];
  placementGroups: PlacementGroup[];
  primaryIps: PrimaryIp[];
  servers: CloudServer[];
  sshKeys: CloudSshKey[];
  volumes: Volume[];
}

export function assembleReport(
  pricing: CloudPricing,
  raw: RawInventory
): InventoryReport {
  const volumeByServer = new Map<number, { count: number; gb: number }>();
  for (const v of raw.volumes) {
    if (v.server !== null) {
      const entry = volumeByServer.get(v.server) ?? { count: 0, gb: 0 };
      entry.count += 1;
      entry.gb += v.size;
      volumeByServer.set(v.server, entry);
    }
  }

  const servers: InventoryServerEntry[] = raw.servers.map((s) => {
    const typeName = s.server_type?.name;
    const base = serverTypeMonthly(pricing, typeName, s.location?.name);
    const withBackup =
      base !== null && s.backup_window
        ? base + backupMonthly(pricing, base)
        : base;
    const warnings: string[] = [];
    if (s.status === "off") {
      warnings.push("stopped server still billed (delete to stop cost)");
    }
    if (base === null) {
      warnings.push(`server type ${typeName ?? "?"} not found in pricing`);
    }
    if (s.server_type?.deprecated) {
      warnings.push("deprecated server type");
    }
    return {
      id: s.id,
      name: s.name,
      type: typeName ?? null,
      location: s.location?.name ?? "?",
      status: s.status,
      created: s.created,
      ipv4: s.public_net?.ipv4?.ip ?? null,
      ipv6: s.public_net?.ipv6?.ip ?? null,
      primaryDiskGb: s.primary_disk_size,
      volumes: volumeByServer.get(s.id)?.count ?? 0,
      volumeGb: volumeByServer.get(s.id)?.gb ?? 0,
      backup: s.backup_window !== null,
      monthly: roundCost(withBackup),
      warnings,
    };
  });

  const volumes: InventoryVolumeEntry[] = raw.volumes.map((v) => {
    const warnings: string[] = [];
    if (v.server === null) {
      warnings.push("unattached volume still billed");
    }
    return {
      id: v.id,
      name: v.name,
      sizeGb: v.size,
      location: v.location?.name ?? "?",
      status: v.status,
      attachedTo: v.server,
      monthly: roundCost(volumeMonthly(pricing, v.size)),
      warnings,
    };
  });

  const ips: InventoryIpEntry[] = [
    ...raw.primaryIps.map((p): InventoryIpEntry => {
      const warnings: string[] = [];
      if (p.assignee_type === "unassigned") {
        warnings.push("unassigned primary IP still billed");
      }
      return {
        id: p.id,
        kind: "primary",
        type: p.type,
        ip: p.ip,
        location: p.location?.name ?? "?",
        assignedTo: primaryIpAssignee(p),
        monthly: roundCost(primaryIpMonthly(pricing, p.type, p.location?.name)),
        warnings,
      };
    }),
    ...raw.floatingIps.map((f): InventoryIpEntry => {
      const warnings: string[] = [];
      if (f.server === null) {
        warnings.push("unassigned floating IP still billed");
      }
      return {
        id: f.id,
        kind: "floating",
        type: f.type,
        ip: f.ip,
        location: f.home_location?.name ?? "?",
        assignedTo: f.server === null ? null : `server ${f.server}`,
        monthly: roundCost(
          floatingIpMonthly(pricing, f.type, f.home_location?.name)
        ),
        warnings,
      };
    }),
  ];

  const loadBalancers: InventoryLoadBalancerEntry[] = raw.loadBalancers.map(
    (lb) => ({
      id: lb.id,
      name: lb.name,
      type: lb.load_balancer_type?.name ?? null,
      location: lb.location?.name ?? "?",
      publicIpv4: lb.public_net?.enabled
        ? (lb.public_net.ipv4?.ip ?? null)
        : null,
      targets: lb.targets?.length ?? 0,
      monthly: roundCost(
        loadBalancerTypeMonthly(
          pricing,
          lb.load_balancer_type?.name,
          lb.location?.name
        )
      ),
      warnings: [],
    })
  );

  const billedImages = raw.images.filter(
    (i) => i.type === "snapshot" || i.type === "backup"
  );
  const imagesReport: InventoryImageEntry[] = billedImages.map((i) => ({
    id: i.id,
    name: i.name,
    type: i.type,
    sizeGb: Math.ceil(i.image_size ?? i.disk_size ?? 0),
    boundTo: i.bound_to,
    monthly: roundCost(
      imageMonthly(pricing, Math.ceil(i.image_size ?? i.disk_size ?? 0))
    ),
    warnings: [],
  }));

  const warnings: string[] = [];
  for (const s of servers) {
    for (const w of s.warnings) {
      warnings.push(`server ${s.name}: ${w}`);
    }
  }
  for (const v of volumes) {
    for (const w of v.warnings) {
      warnings.push(`volume ${v.name}: ${w}`);
    }
  }
  for (const ip of ips) {
    for (const w of ip.warnings) {
      warnings.push(`${ip.kind} ip ${ip.ip}: ${w}`);
    }
  }

  const serverCosts = servers.map((s) => s.monthly);
  const volumeCosts = volumes.map((v) => v.monthly);
  const ipCosts = ips.map((i) => i.monthly);
  const lbCosts = loadBalancers.map((l) => l.monthly);
  const imageCosts = imagesReport.map((i) => i.monthly);

  return {
    generatedAt: new Date().toISOString(),
    currency: pricing.currency,
    vatRate: pricing.vat_rate,
    note: "Costs are list-price estimates (GET /pricing gross monthly x inventory); Hetzner has no billing API. Dedicated (Robot) servers are contract-priced and not included.",
    servers,
    volumes,
    ips,
    loadBalancers,
    images: imagesReport,
    counts: {
      networks: raw.networks.length,
      firewalls: raw.firewalls.length,
      certificates: raw.certificates.length,
      sshKeys: raw.sshKeys.length,
      placementGroups: raw.placementGroups.length,
    },
    totals: {
      monthly: sumNullable([
        ...serverCosts,
        ...volumeCosts,
        ...ipCosts,
        ...lbCosts,
        ...imageCosts,
      ]),
      servers: sumNullable(serverCosts),
      volumes: sumNullable(volumeCosts),
      ips: sumNullable(ipCosts),
      loadBalancers: sumNullable(lbCosts),
      images: sumNullable(imageCosts),
    },
    warnings,
  };
}
