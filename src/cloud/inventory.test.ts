import { describe, expect, it } from "vitest";
import { formatInventoryReport } from "./formatter.js";
import { assembleReport } from "./inventory.js";
import type { CloudPricing } from "./types.js";

type RawInventory = Parameters<typeof assembleReport>[1];

const BASE_MONTHLY = 10;
const BACKUP_PERCENT = 20;

const pricing = {
  currency: "EUR",
  floating_ips: [],
  image: { price_per_gb_month: { gross: "0", net: "0" } },
  load_balancer_types: [],
  primary_ips: [],
  server_backup: { percentage: String(BACKUP_PERCENT) },
  server_types: [
    {
      name: "cx22",
      prices: [
        {
          included_traffic: 0,
          location: "fsn1",
          price_hourly: { gross: "0", net: "0" },
          price_monthly: {
            gross: String(BASE_MONTHLY),
            net: String(BASE_MONTHLY),
          },
          price_per_tb_traffic: { gross: "0", net: "0" },
        },
      ],
    },
  ],
  vat_rate: "19.0000000000",
  volume: { price_per_gb_month: { gross: "0", net: "0" } },
} as unknown as CloudPricing;

function rawInventory(overrides: Partial<RawInventory> = {}): RawInventory {
  return {
    certificates: [],
    firewalls: [],
    floatingIps: [],
    images: [],
    loadBalancers: [],
    networks: [],
    placementGroups: [],
    primaryIps: [],
    servers: [],
    sshKeys: [],
    volumes: [],
    ...overrides,
  };
}

function server(typeName: string, backupWindow: string | null) {
  return {
    backup_window: backupWindow,
    id: 1,
    location: { name: "fsn1" },
    name: "web",
    server_type: { name: typeName },
    status: "running",
  } as unknown as RawInventory["servers"][number];
}

function primaryIp(assigneeType: string, assigneeId: number | null) {
  return {
    assignee_id: assigneeId,
    assignee_type: assigneeType,
    id: 1,
    ip: "1.2.3.4",
    location: { name: "fsn1" },
    type: "ipv4",
  } as unknown as RawInventory["primaryIps"][number];
}

describe("assembleReport", () => {
  it("should add the backup surcharge when a backup window is set", () => {
    const report = assembleReport(
      pricing,
      rawInventory({ servers: [server("cx22", "22-02")] })
    );

    expect(report.servers[0].monthly).toBeCloseTo(12);
  });

  it("should use the base price without a backup window", () => {
    const report = assembleReport(
      pricing,
      rawInventory({ servers: [server("cx22", null)] })
    );

    expect(report.servers[0].monthly).toBeCloseTo(BASE_MONTHLY);
  });

  it("should report an unknown price even with a backup window", () => {
    const report = assembleReport(
      pricing,
      rawInventory({ servers: [server("unknown", "22-02")] })
    );

    expect(report.servers[0].monthly).toBeNull();
  });

  it("should describe primary IP assignees", () => {
    const report = assembleReport(
      pricing,
      rawInventory({
        primaryIps: [
          primaryIp("server", 7),
          primaryIp("load_balancer", 8),
          primaryIp("unassigned", null),
        ],
      })
    );

    expect(report.ips.map((ip) => ip.assignedTo)).toEqual([
      "server 7",
      "load balancer 8",
      null,
    ]);
  });
});

describe("formatInventoryReport", () => {
  it("should omit empty sections", () => {
    const result = formatInventoryReport(
      assembleReport(pricing, rawInventory())
    );

    expect(result).not.toContain("Servers (");
    expect(result).toContain("Estimated Monthly Cost");
  });

  it("should render a section with its count and unknown costs", () => {
    const result = formatInventoryReport(
      assembleReport(
        pricing,
        rawInventory({ servers: [server("unknown", null)] })
      )
    );

    expect(result).toContain("Servers (1)");
    expect(result).toContain("?");
  });
});
