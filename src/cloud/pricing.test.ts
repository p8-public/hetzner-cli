import { describe, expect, it } from "vitest";
import {
  backupMonthly,
  floatingIpMonthly,
  imageMonthly,
  primaryIpMonthly,
  roundCost,
  serverTypeMonthly,
  toNumber,
  trafficOverageMonthly,
  volumeMonthly,
} from "./pricing.js";
import type { CloudPricing } from "./types.js";

const pricing: CloudPricing = {
  currency: "EUR",
  vat_rate: "19.0000000000",
  server_types: [
    {
      name: "cx22",
      prices: [
        {
          location: "fsn1",
          price_hourly: { net: "0.0072", gross: "0.0072" },
          price_monthly: { net: "4.49", gross: "4.49" },
          included_traffic: 21_990_232_555_520,
          price_per_tb_traffic: { net: "1.0", gross: "1.0" },
        },
        {
          location: "hel1",
          price_hourly: { net: "0.0069", gross: "0.0069" },
          price_monthly: { net: "4.29", gross: "4.29" },
          included_traffic: 21_990_232_555_520,
          price_per_tb_traffic: { net: "1.0", gross: "1.0" },
        },
      ],
    },
  ],
  load_balancer_types: [
    {
      name: "lb11",
      prices: [
        {
          location: "fsn1",
          price_hourly: { net: "0.0112", gross: "0.0112" },
          price_monthly: { net: "6.99", gross: "6.99" },
          included_traffic: 21_990_232_555_520,
          price_per_tb_traffic: { net: "1.0", gross: "1.0" },
        },
      ],
    },
  ],
  primary_ips: [
    {
      type: "ipv4",
      prices: [
        {
          location: "fsn1",
          price_hourly: { net: "0.0008", gross: "0.0008" },
          price_monthly: { net: "0.5", gross: "0.5" },
        },
      ],
    },
  ],
  floating_ips: [
    {
      type: "ipv4",
      prices: [
        {
          location: "fsn1",
          price_monthly: { net: "3.0", gross: "3.0" },
        },
      ],
    },
  ],
  volume: { price_per_gb_month: { net: "0.0572", gross: "0.0572" } },
  image: { price_per_gb_month: { net: "0.0143", gross: "0.0143" } },
  server_backup: { percentage: "20.0000000000" },
};

describe("toNumber", () => {
  it("parses gross amounts", () => {
    expect(toNumber({ net: "1.0", gross: "4.49" })).toBe(4.49);
  });
  it("returns null for missing amounts", () => {
    expect(toNumber(undefined)).toBeNull();
  });
});

describe("serverTypeMonthly", () => {
  it("picks the price for the exact location", () => {
    expect(serverTypeMonthly(pricing, "cx22", "hel1")).toBe(4.29);
  });
  it("falls back to the cheapest location for unpriced locations", () => {
    expect(serverTypeMonthly(pricing, "cx22", "ash")).toBe(4.29);
  });
  it("falls back when no location is given", () => {
    expect(serverTypeMonthly(pricing, "cx22", undefined)).toBe(4.29);
  });
  it("returns null for unknown types", () => {
    expect(serverTypeMonthly(pricing, "ccx99", "fsn1")).toBeNull();
  });
});

describe("volumeMonthly", () => {
  it("multiplies per-GB price by size", () => {
    expect(volumeMonthly(pricing, 100)).toBeCloseTo(5.72, 5);
  });
});

describe("imageMonthly", () => {
  it("multiplies per-GB price by size", () => {
    expect(imageMonthly(pricing, 40)).toBeCloseTo(0.572, 5);
  });
});

describe("primaryIpMonthly / floatingIpMonthly", () => {
  it("prices primary ipv4", () => {
    expect(primaryIpMonthly(pricing, "ipv4", "fsn1")).toBe(0.5);
  });
  it("returns null for unpriced ip types", () => {
    expect(primaryIpMonthly(pricing, "ipv6", "fsn1")).toBeNull();
    expect(floatingIpMonthly(pricing, "ipv6", "fsn1")).toBeNull();
  });
  it("prices floating ipv4 without hourly entry", () => {
    expect(floatingIpMonthly(pricing, "ipv4", "fsn1")).toBe(3.0);
  });
});

describe("backupMonthly", () => {
  it("adds the configured percentage", () => {
    expect(backupMonthly(pricing, 10)).toBeCloseTo(2.0, 5);
  });
});

describe("trafficOverageMonthly", () => {
  const price = pricing.server_types[0].prices[0];
  it("is zero within the included allowance", () => {
    expect(trafficOverageMonthly(price, 1024 ** 3, 21_990_232_555_520)).toBe(0);
  });
  it("bills per TB beyond the allowance", () => {
    const tb = 1024 ** 4;
    expect(trafficOverageMonthly(price, tb * 2, tb)).toBeCloseTo(1.0, 5);
  });
  it("returns null when outgoing traffic is unknown", () => {
    expect(trafficOverageMonthly(price, null, 21_990_232_555_520)).toBeNull();
  });
});

describe("roundCost", () => {
  it("rounds to cents", () => {
    expect(roundCost(5.719_999_9)).toBe(5.72);
    expect(roundCost(null)).toBeNull();
  });
});
