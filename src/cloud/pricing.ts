import type {
  CloudPricing,
  IpPrice,
  IpTypePricing,
  NamedTypePricing,
  PriceAmount,
  PricingServerTypePrice,
} from "./types.js";

/**
 * Pure helpers over the GET /pricing payload.
 *
 * Hetzner exposes list prices, not per-account billing: there is no
 * billing/invoice API on either the Cloud or the Robot API, so "cost" here
 * always means an estimate from list prices (gross, monthly) times live
 * inventory. See `hctl cloud inventory`.
 */

export function toNumber(amount: PriceAmount | undefined): number | null {
  if (!amount) {
    return null;
  }
  const value = Number.parseFloat(amount.gross);
  return Number.isFinite(value) ? value : null;
}

/**
 * Pick the price entry for a location, falling back to the cheapest
 * available location when the resource's location is not priced (new
 * region, stale pricing payload).
 */
function pickLocationPrice<
  T extends { location: string; price_monthly: PriceAmount },
>(prices: T[], location: string | undefined): T | undefined {
  if (prices.length === 0) {
    return undefined;
  }
  const exact = location
    ? prices.find((p) => p.location === location)
    : undefined;
  if (exact) {
    return exact;
  }
  return prices.reduce((cheapest, p) =>
    (toNumber(p.price_monthly) ?? Number.POSITIVE_INFINITY) <
    (toNumber(cheapest.price_monthly) ?? Number.POSITIVE_INFINITY)
      ? p
      : cheapest
  );
}

function namedTypeMonthly(
  table: NamedTypePricing[],
  name: string | undefined,
  location: string | undefined
): number | null {
  const entry = table.find((t) => t.name === name);
  if (!entry) {
    return null;
  }
  return toNumber(pickLocationPrice(entry.prices, location)?.price_monthly);
}

export function serverTypeMonthly(
  pricing: CloudPricing,
  serverTypeName: string | undefined,
  location: string | undefined
): number | null {
  return namedTypeMonthly(pricing.server_types, serverTypeName, location);
}

export function loadBalancerTypeMonthly(
  pricing: CloudPricing,
  lbTypeName: string | undefined,
  location: string | undefined
): number | null {
  return namedTypeMonthly(pricing.load_balancer_types, lbTypeName, location);
}

function ipMonthly(
  table: IpTypePricing[],
  ipType: "ipv4" | "ipv6",
  location: string | undefined
): number | null {
  const entry = table.find((t) => t.type === ipType);
  if (!entry) {
    return null;
  }
  const price = pickLocationPrice(entry.prices, location);
  return toNumber(price?.price_monthly);
}

export function primaryIpMonthly(
  pricing: CloudPricing,
  ipType: "ipv4" | "ipv6",
  location: string | undefined
): number | null {
  return ipMonthly(pricing.primary_ips, ipType, location);
}

export function floatingIpMonthly(
  pricing: CloudPricing,
  ipType: "ipv4" | "ipv6",
  location: string | undefined
): number | null {
  return ipMonthly(pricing.floating_ips, ipType, location);
}

export function volumeMonthly(
  pricing: CloudPricing,
  sizeGb: number
): number | null {
  const perGb = toNumber(pricing.volume.price_per_gb_month);
  return perGb === null ? null : perGb * sizeGb;
}

export function imageMonthly(
  pricing: CloudPricing,
  sizeGb: number
): number | null {
  const perGb = toNumber(pricing.image.price_per_gb_month);
  return perGb === null ? null : perGb * sizeGb;
}

/**
 * Server backups cost a percentage on top of the base server price.
 */
export function backupMonthly(
  pricing: CloudPricing,
  baseMonthly: number
): number {
  const percentage = Number.parseFloat(pricing.server_backup.percentage);
  if (!Number.isFinite(percentage)) {
    return 0;
  }
  return (baseMonthly * percentage) / 100;
}

/**
 * Overage cost for traffic beyond the included allowance. Returns null when
 * the pricing entry lacks a per-TB traffic price.
 */
export function trafficOverageMonthly(
  price: PricingServerTypePrice | IpPrice | undefined,
  outgoingBytes: number | null,
  includedBytes: number
): number | null {
  if (outgoingBytes === null) {
    return null;
  }
  const overBytes = Math.max(0, outgoingBytes - includedBytes);
  if (overBytes === 0) {
    return 0;
  }
  const perTb = toNumber(
    (price as PricingServerTypePrice | undefined)?.price_per_tb_traffic
  );
  if (perTb === null) {
    return null;
  }
  const TB = 1024 ** 4;
  return (overBytes / TB) * perTb;
}

/** Round for display: list prices carry 4+ decimal places. */
export function roundCost(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}
