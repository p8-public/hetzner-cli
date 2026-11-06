import type Database from "better-sqlite3";
import { type Command, Option } from "commander";
import {
  colorize,
  error,
  formatJson,
  info,
  success,
  warning,
} from "../shared/formatter.js";
import { fetchAuctionDataWithCache } from "./cache.js";
import {
  type AuctionFetchOptions,
  type AuctionFetchResult,
  type AuctionSource,
  filterAuctionServers,
  sortAuctionServers,
} from "./client.js";
import { computeDiff, type DiffResult } from "./diff.js";
import { formatDiff } from "./diff-formatter.js";
import {
  type AuctionCacheStatus,
  type AuctionStatusSummary,
  formatAuctionDetails,
  formatAuctionFetchMetadata,
  formatAuctionList,
  formatAuctionStatus,
} from "./formatter.js";
import {
  getAuctionCache,
  getLatestSnapshot,
  getSnapshotServers,
  openDatabase,
  pruneSnapshots,
  type StoredSnapshot,
  saveSnapshot,
} from "./store.js";
import type { AuctionFilterOptions, AuctionServer } from "./types.js";

interface AuctionListOptions {
  auctionOnly?: boolean;
  cpu?: string;
  currency?: "EUR" | "USD";
  datacenter?: string;
  desc?: boolean;
  direct?: boolean;
  diskType?: "nvme" | "sata" | "hdd";
  ecc?: boolean;
  fixedPrice?: boolean;
  gpu?: boolean;
  highio?: boolean;
  inic?: boolean;
  json?: boolean;
  limit?: string;
  maxCpuCount?: string;
  maxDiskCount?: string;
  maxDiskSize?: string;
  maxHourlyPrice?: string;
  maxPrice?: string;
  maxRam?: string;
  maxSetupPrice?: string;
  minBandwidth?: string;
  minCpuCount?: string;
  minDiskCount?: string;
  minDiskSize?: string;
  minPrice?: string;
  minRam?: string;
  noSetupFee?: boolean;
  search?: string;
  sort?: string;
  specials?: string;
}

interface AuctionShowOptions {
  currency?: "EUR" | "USD";
  direct?: boolean;
  json?: boolean;
}

interface AuctionStatusOptions {
  currency?: "EUR" | "USD";
  direct?: boolean;
  json?: boolean;
}

interface AuctionDiffOptions {
  currency?: "EUR" | "USD";
  direct?: boolean;
  json?: boolean;
}

interface AuctionWatchOptions {
  currency?: "EUR" | "USD";
  direct?: boolean;
  interval?: string;
  json?: boolean;
  quiet?: boolean;
}

function resolveFixedPrice(
  fixedPrice: boolean | undefined,
  auctionOnly: boolean | undefined
): boolean | undefined {
  if (fixedPrice) {
    return true;
  }
  if (auctionOnly) {
    return false;
  }
  return undefined;
}

function parseNum(val: string | undefined): number | undefined {
  if (val === undefined) {
    return undefined;
  }
  const n = Number(val);
  return Number.isNaN(n) ? undefined : n;
}

function buildFilters(options: AuctionListOptions): AuctionFilterOptions {
  return {
    minPrice: parseNum(options.minPrice),
    maxPrice: parseNum(options.maxPrice),
    maxHourlyPrice: parseNum(options.maxHourlyPrice),
    minRam: parseNum(options.minRam),
    maxRam: parseNum(options.maxRam),
    cpu: options.cpu,
    datacenter: options.datacenter,
    minDiskSize: parseNum(options.minDiskSize),
    maxDiskSize: parseNum(options.maxDiskSize),
    minDiskCount: parseNum(options.minDiskCount),
    maxDiskCount: parseNum(options.maxDiskCount),
    diskType: options.diskType,
    minBandwidth: parseNum(options.minBandwidth),
    ecc: options.ecc ? true : undefined,
    gpu: options.gpu ? true : undefined,
    inic: options.inic ? true : undefined,
    highio: options.highio ? true : undefined,
    specials: options.specials,
    fixedPrice: resolveFixedPrice(options.fixedPrice, options.auctionOnly),
    maxSetupPrice: options.noSetupFee ? 0 : parseNum(options.maxSetupPrice),
    minCpuCount: parseNum(options.minCpuCount),
    maxCpuCount: parseNum(options.maxCpuCount),
    text: options.search,
  };
}

interface AuctionSourceOptions {
  direct?: boolean;
}

function buildFetchOptions(options: AuctionSourceOptions): AuctionFetchOptions {
  return options.direct ? { source: "direct" } : {};
}

/** Status messages stay off stdout in JSON mode so it remains parseable. */
function statusLog(options: { json?: boolean }): (message: string) => void {
  return options.json ? console.error : console.log;
}

function maybeWarnAboutLocalCache(
  metadata: AuctionFetchResult["metadata"],
  options: { json?: boolean }
): void {
  if (options.json && metadata.source === "local-cache") {
    console.error(warning(formatAuctionFetchMetadata(metadata)));
  }
}

function toCacheStatus(result: AuctionFetchResult): AuctionCacheStatus {
  return {
    ageSeconds: result.metadata.ageSeconds,
    fetchedAt: result.metadata.fetchedAt,
    serverCount: result.data.serverCount ?? result.data.server.length,
    source: result.metadata.source,
    stale: result.metadata.stale ?? false,
    updatedAt: result.metadata.updatedAt,
    url: result.metadata.url,
  };
}

function readLocalAuctionCacheStatus(
  currency: "EUR" | "USD"
): AuctionCacheStatus | null {
  let db: ReturnType<typeof openDatabase> | null = null;
  try {
    db = openDatabase();
    const cached = getAuctionCache(db, currency);
    return cached === null ? null : toCacheStatus(cached);
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

async function getAuctionStatusSummary(
  currency: "EUR" | "USD",
  options: AuctionSourceOptions
): Promise<AuctionStatusSummary> {
  const result = await fetchAuctionDataWithCache(currency, {
    ...buildFetchOptions(options),
    allowLocalFallback: true,
  });
  const current = toCacheStatus(result);
  return {
    ...current,
    currency,
    endpointUrl: result.metadata.url,
    localCache: readLocalAuctionCacheStatus(currency),
    usingLocalFallback: result.metadata.source === "local-cache",
  };
}

interface SnapshotDiffResult {
  current: StoredSnapshot;
  diff: DiffResult;
  previous: StoredSnapshot;
}

const EMPTY_PAYLOAD_RATIO = 0.5;

function isSuspiciousEmptyPayload(
  servers: AuctionServer[],
  previous: StoredSnapshot | null
): boolean {
  if (servers.length === 0) {
    return true;
  }
  if (previous && previous.serverCount > 0) {
    return servers.length < previous.serverCount * EMPTY_PAYLOAD_RATIO;
  }
  return false;
}

function fetchAndDiff(
  db: Database.Database,
  servers: AuctionServer[],
  currency: string,
  options: { json?: boolean }
): SnapshotDiffResult | null {
  const previous = getLatestSnapshot(db, currency);
  if (!previous) {
    if (isSuspiciousEmptyPayload(servers, null)) {
      console.error(
        warning("Skipping initial snapshot: upstream returned no servers")
      );
      return null;
    }
    const snapshot = saveSnapshot(db, servers, currency);
    statusLog(options)(
      success(
        `Initial snapshot saved (${snapshot.serverCount} servers, snapshot #${snapshot.id})`
      )
    );
    return null;
  }

  if (isSuspiciousEmptyPayload(servers, previous)) {
    console.error(
      warning(
        `Skipping snapshot: upstream returned ${servers.length} server(s) (was ${previous.serverCount}). Refusing to overwrite baseline with suspicious payload.`
      )
    );
    return null;
  }

  const previousServers = getSnapshotServers(db, previous.id);
  const diff = computeDiff(previousServers, servers);
  const hasChanges =
    diff.added.length > 0 ||
    diff.removed.length > 0 ||
    diff.priceChanged.length > 0;

  if (!hasChanges) {
    return { previous, current: previous, diff };
  }

  const current = saveSnapshot(db, servers, currency);
  pruneSnapshots(db, currency);
  return { previous, current, diff };
}

interface PollOptions {
  json?: boolean;
  quiet?: boolean;
  source?: AuctionSource;
}

async function pollOnce(
  db: Database.Database,
  currency: "EUR" | "USD",
  options: PollOptions
): Promise<void> {
  const {
    data: { server: servers },
    metadata,
  } = await fetchAuctionDataWithCache(currency, {
    allowLocalFallback: false,
    source: options.source,
  });
  const result = fetchAndDiff(db, servers, currency, options);
  if (!result) {
    return;
  }

  const { diff, previous: prev, current: curr } = result;
  const hasChanges =
    diff.added.length > 0 ||
    diff.removed.length > 0 ||
    diff.priceChanged.length > 0;

  if (options.quiet && !hasChanges) {
    return;
  }

  if (options.json) {
    console.log(formatJson({ timestamp: curr.takenAt, ...diff }));
  } else {
    const ts = colorize(`[${new Date().toLocaleTimeString()}]`, "dim");
    console.log(
      `${ts} ${formatAuctionFetchMetadata(metadata)}\n${formatDiff(diff, prev, curr)}`
    );
  }
}

function auctionAction(fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    try {
      await fn();
    } catch (err) {
      console.error(
        error(
          err instanceof Error ? err.message : "Failed to fetch auction data"
        )
      );
      process.exit(1);
    }
  };
}

export function registerAuctionCommands(parent: Command): void {
  const auction = parent
    .command("auction")
    .description(
      "Server auction monitoring (public, no auth required).\n" +
        "Fetches the current public auction inventory from the hosted auction cache by default and filters/sorts client-side.\n" +
        "Typical ranges: 30-450 EUR/mo, 32-1024 GB RAM, NVMe/SATA/HDD, datacenters in FSN/HEL/NBG."
    );

  // The root command also declares --json and consumes the flag wherever it
  // appears, so copy it onto the subcommand that is about to run.
  auction.hook("preAction", (_auction, actionCommand) => {
    if (actionCommand.optsWithGlobals().json) {
      actionCommand.setOptionValue("json", true);
    }
  });

  auction
    .command("list")
    .alias("ls")
    .description(
      "List and filter auction servers.\n" +
        "All filters are optional and combinable. String filters (cpu, datacenter, specials, search) are case-insensitive substrings.\n" +
        "Examples:\n" +
        "  hctl auction list --cpu epyc --ecc --disk-type nvme --datacenter HEL --sort price\n" +
        "  hctl auction list --gpu --max-price 150 --json\n" +
        "  hctl auction list --auction-only --sort next_reduce --limit 20"
    )
    .option("--min-price <n>", "Minimum monthly price")
    .option("--max-price <n>", "Maximum monthly price")
    .option("--max-hourly-price <n>", "Maximum hourly price")
    .option("--min-ram <gb>", "Minimum RAM in GB")
    .option("--max-ram <gb>", "Maximum RAM in GB")
    .option("--cpu <text>", 'CPU model substring (e.g. "Ryzen", "i7-6700")')
    .option("--min-cpu-count <n>", "Minimum CPU/socket count")
    .option("--max-cpu-count <n>", "Maximum CPU/socket count")
    .option(
      "--datacenter <text>",
      'Datacenter substring (e.g. "FSN", "HEL1-DC2")'
    )
    .option("--min-disk-size <gb>", "Minimum total disk capacity in GB")
    .option("--max-disk-size <gb>", "Maximum total disk capacity in GB")
    .option("--min-disk-count <n>", "Minimum number of drives")
    .option("--max-disk-count <n>", "Maximum number of drives")
    .addOption(
      new Option("--disk-type <type>", "Filter by disk type present").choices([
        "nvme",
        "sata",
        "hdd",
      ])
    )
    .option("--min-bandwidth <mbit>", "Minimum bandwidth in Mbit/s")
    .option("--ecc", "Only ECC RAM servers")
    .option("--gpu", "Only GPU servers")
    .option("--inic", "Only servers with Intel NIC")
    .option("--highio", "Only high I/O servers")
    .option("--specials <text>", "Filter by special feature (substring match)")
    .option("--fixed-price", "Only fixed-price servers")
    .option("--auction-only", "Only auction (non-fixed) servers")
    .option("--no-setup-fee", "Only servers with no setup fee")
    .option("--max-setup-price <n>", "Maximum setup price")
    .option("--search <text>", "Free-text search across description")
    .addOption(
      new Option("--currency <currency>", "Price currency")
        .choices(["EUR", "USD"])
        .default("EUR")
    )
    .option(
      "--direct",
      "Fetch directly from Hetzner instead of the hosted auction cache"
    )
    .addOption(
      new Option("--sort <field>", "Sort by field")
        .choices([
          "price",
          "hourly",
          "setup",
          "ram",
          "disk",
          "disk_count",
          "cpu",
          "cpu_count",
          "datacenter",
          "bandwidth",
          "next_reduce",
        ])
        .default("price")
    )
    .option("--desc", "Sort in descending order")
    .option("--limit <n>", "Limit output rows")
    .option("--json", "Output raw JSON")
    .action((options: AuctionListOptions) =>
      auctionAction(async () => {
        const {
          data: { server: servers },
          metadata,
        } = await fetchAuctionDataWithCache(options.currency, {
          ...buildFetchOptions(options),
          allowLocalFallback: true,
        });

        const filters = buildFilters(options);
        let filtered = filterAuctionServers(servers, filters);
        filtered = sortAuctionServers(
          filtered,
          options.sort || "price",
          !!options.desc
        );

        const limit = parseNum(options.limit);
        if (limit !== undefined && limit > 0) {
          filtered = filtered.slice(0, limit);
        }

        if (options.json) {
          maybeWarnAboutLocalCache(metadata, options);
          console.log(formatJson(filtered));
        } else {
          console.log(
            `${formatAuctionFetchMetadata(metadata)}\n${formatAuctionList(filtered)}`
          );
        }
      })()
    );

  auction
    .command("show <id>")
    .description(
      "Show detailed info for an auction server.\n" +
        "Displays CPU, RAM, disk breakdown by type, datacenter, pricing (monthly + hourly),\n" +
        "specials (GPU, iNIC, ECC), IP pricing, and full description.\n" +
        "Example: hctl auction show 2919866"
    )
    .addOption(
      new Option("--currency <currency>", "Price currency")
        .choices(["EUR", "USD"])
        .default("EUR")
    )
    .option(
      "--direct",
      "Fetch directly from Hetzner instead of the hosted auction cache"
    )
    .option("--json", "Output raw JSON")
    .action((id: string, options: AuctionShowOptions) =>
      auctionAction(async () => {
        const serverId = Number.parseInt(id, 10);
        if (Number.isNaN(serverId)) {
          console.error(error("Invalid server ID"));
          process.exit(1);
        }

        const {
          data: { server: servers },
          metadata,
        } = await fetchAuctionDataWithCache(options.currency, {
          ...buildFetchOptions(options),
          allowLocalFallback: true,
        });
        const server = servers.find((s) => s.id === serverId);

        if (!server) {
          console.error(error(`Auction server ${id} not found`));
          process.exit(1);
        }

        if (options.json) {
          maybeWarnAboutLocalCache(metadata, options);
          console.log(formatJson(server));
        } else {
          console.log(
            `${formatAuctionFetchMetadata(metadata)}\n${formatAuctionDetails(server)}`
          );
        }
      })()
    );

  auction
    .command("status")
    .description(
      "Show auction data freshness and cache status.\n" +
        "Reports hosted cache source, update timestamp, age, stale flag, server count,\n" +
        "and local offline cache state. Use --json for machine-readable output."
    )
    .addOption(
      new Option("--currency <currency>", "Price currency")
        .choices(["EUR", "USD"])
        .default("EUR")
    )
    .option(
      "--direct",
      "Check Hetzner direct instead of the hosted auction cache"
    )
    .option("--json", "Output status as JSON")
    .action((options: AuctionStatusOptions) =>
      auctionAction(async () => {
        const status = await getAuctionStatusSummary(
          options.currency as "EUR" | "USD",
          options
        );

        if (options.json) {
          console.log(formatJson(status));
        } else {
          console.log(formatAuctionStatus(status));
        }
      })()
    );

  auction
    .command("diff")
    .description(
      "Show changes since last snapshot.\n" +
        "Fetches current auction data, compares against the most recent stored snapshot,\n" +
        "and shows added, removed, and price-changed servers.\n" +
        "Example: hctl auction diff"
    )
    .addOption(
      new Option("--currency <currency>", "Price currency")
        .choices(["EUR", "USD"])
        .default("EUR")
    )
    .option(
      "--direct",
      "Fetch directly from Hetzner instead of the hosted auction cache"
    )
    .option("--json", "Output diff as JSON")
    .action((options: AuctionDiffOptions) =>
      auctionAction(async () => {
        const currency = options.currency as "EUR" | "USD";
        const db = openDatabase();
        try {
          const {
            data: { server: servers },
            metadata,
          } = await fetchAuctionDataWithCache(currency, {
            ...buildFetchOptions(options),
            allowLocalFallback: false,
          });
          if (!options.json) {
            console.log(formatAuctionFetchMetadata(metadata));
          }
          const result = fetchAndDiff(db, servers, currency, options);
          if (!result) {
            return;
          }

          if (options.json) {
            console.log(formatJson(result.diff));
          } else {
            console.log(
              formatDiff(result.diff, result.previous, result.current)
            );
          }
        } finally {
          db.close();
        }
      })()
    );

  auction
    .command("watch")
    .description(
      "Continuously monitor auction changes.\n" +
        "Polls the auction API at a configurable interval and prints changes as they occur.\n" +
        "Press Ctrl+C to stop.\n" +
        "Example: hctl auction watch --interval 10"
    )
    .option("--interval <minutes>", "Polling interval in minutes", "5")
    .addOption(
      new Option("--currency <currency>", "Price currency")
        .choices(["EUR", "USD"])
        .default("EUR")
    )
    .option(
      "--direct",
      "Fetch directly from Hetzner instead of the hosted auction cache"
    )
    .option("--json", "Output diffs as JSON")
    .option("--quiet", "Only show output when changes are detected")
    .action((options: AuctionWatchOptions) =>
      auctionAction(async () => {
        const currency = options.currency as "EUR" | "USD";
        const intervalMin = parseWatchInterval(options.interval);
        const intervalMs = intervalMin * 60 * 1000;
        const db = openDatabase();
        const fetchOptions = buildFetchOptions(options);

        let shuttingDown = false;
        let timer: NodeJS.Timeout | null = null;
        let drainTimer: NodeJS.Timeout | null = null;
        const requestShutdown = () => {
          if (shuttingDown) {
            return;
          }
          shuttingDown = true;
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          drainTimer = setTimeout(() => {
            console.error(
              warning(
                `Drain timeout (${SHUTDOWN_DRAIN_MS / 1000}s) reached; forcing exit.`
              )
            );
            db.close();
            process.exit(0);
          }, SHUTDOWN_DRAIN_MS);
          drainTimer.unref?.();
        };
        process.once("SIGINT", requestShutdown);
        process.once("SIGTERM", requestShutdown);

        statusLog(options)(
          info(
            `Watching auction (${currency}, every ${intervalMin}min). Press Ctrl+C to stop.`
          )
        );

        const poll = () =>
          pollOnce(db, currency, {
            ...options,
            source: fetchOptions.source,
          }).catch((err) => {
            console.error(
              error(err instanceof Error ? err.message : "Poll failed")
            );
          });

        try {
          while (!shuttingDown) {
            await poll();
            if (shuttingDown) {
              break;
            }
            await new Promise<void>((resolve) => {
              timer = setTimeout(() => {
                timer = null;
                resolve();
              }, intervalMs);
            });
          }
        } finally {
          if (drainTimer) {
            clearTimeout(drainTimer);
          }
          process.removeListener("SIGINT", requestShutdown);
          process.removeListener("SIGTERM", requestShutdown);
          db.close();
        }
      })()
    );
}

const SHUTDOWN_DRAIN_MS = 30_000;

const MAX_WATCH_INTERVAL_MIN = 24 * 60;

function parseWatchInterval(raw: string | undefined): number {
  if (raw === undefined) {
    return 5;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > MAX_WATCH_INTERVAL_MIN) {
    throw new Error(
      `Invalid --interval "${raw}": expected a number between 1 and ${MAX_WATCH_INTERVAL_MIN} (minutes).`
    );
  }
  return n;
}
