import { existsSync, mkdirSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import type { AuctionFetchMetadata } from "./client.js";
import type { AuctionServer } from "./types.js";

const CONFIG_DIR = join(homedir(), ".hctl");
const DB_PATH = join(CONFIG_DIR, "auction.db");
// Pre-1.0 builds wrote the auction DB under ~/.hetzner-cli. We migrate it once
// to the new ~/.hctl location so the old directory stops accumulating state.
const LEGACY_DB_PATH = join(homedir(), ".hetzner-cli", "auction.db");

export interface StoredSnapshot {
  currency: string;
  id: number;
  serverCount: number;
  takenAt: string;
}

export interface CachedAuctionData {
  data: {
    server: AuctionServer[];
    serverCount: number;
  };
  metadata: AuctionFetchMetadata;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taken_at TEXT NOT NULL DEFAULT (datetime('now')),
      server_count INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR'
    );

    CREATE TABLE IF NOT EXISTS servers (
      snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
      server_id INTEGER NOT NULL,
      price REAL NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (snapshot_id, server_id)
    );

    CREATE INDEX IF NOT EXISTS idx_servers_server_id ON servers(server_id);

    CREATE TABLE IF NOT EXISTS auction_cache (
      currency TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      source TEXT NOT NULL,
      stale INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT,
      url TEXT NOT NULL
    );
  `);
  db.pragma("foreign_keys = ON");
}

export function openDatabase(dbPath?: string): Database.Database {
  const path = dbPath ?? resolveDefaultDbPath();
  ensureDir(dirname(path));
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  initSchema(db);
  return db;
}

function resolveDefaultDbPath(): string {
  if (!existsSync(LEGACY_DB_PATH)) {
    return DB_PATH;
  }
  if (existsSync(DB_PATH)) {
    return DB_PATH;
  }
  ensureDir(dirname(DB_PATH));
  try {
    renameSync(LEGACY_DB_PATH, DB_PATH);
  } catch {
    return LEGACY_DB_PATH;
  }
  return DB_PATH;
}

export function saveSnapshot(
  db: Database.Database,
  servers: AuctionServer[],
  currency: string
): StoredSnapshot {
  const insertSnapshot = db.prepare(
    "INSERT INTO snapshots (server_count, currency) VALUES (?, ?)"
  );
  const insertServer = db.prepare(
    "INSERT INTO servers (snapshot_id, server_id, price, data) VALUES (?, ?, ?, ?)"
  );

  const result = db.transaction(() => {
    const info = insertSnapshot.run(servers.length, currency);
    const snapshotId = info.lastInsertRowid as number;

    for (const server of servers) {
      insertServer.run(
        snapshotId,
        server.id,
        server.price,
        JSON.stringify(server)
      );
    }

    return snapshotId;
  })();

  const row = db
    .prepare(
      "SELECT id, taken_at, server_count, currency FROM snapshots WHERE id = ?"
    )
    .get(result) as {
    id: number;
    taken_at: string;
    server_count: number;
    currency: string;
  };

  return {
    id: row.id,
    takenAt: row.taken_at,
    serverCount: row.server_count,
    currency: row.currency,
  };
}

export function getLatestSnapshot(
  db: Database.Database,
  currency: string
): StoredSnapshot | null {
  const row = db
    .prepare(
      "SELECT id, taken_at, server_count, currency FROM snapshots WHERE currency = ? ORDER BY id DESC LIMIT 1"
    )
    .get(currency) as
    | {
        id: number;
        taken_at: string;
        server_count: number;
        currency: string;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    takenAt: row.taken_at,
    serverCount: row.server_count,
    currency: row.currency,
  };
}

export function getSnapshotServers(
  db: Database.Database,
  snapshotId: number
): AuctionServer[] {
  const rows = db
    .prepare("SELECT data FROM servers WHERE snapshot_id = ?")
    .all(snapshotId) as { data: string }[];

  return rows.map((row) => parseStoredServer(row.data));
}

function parseStoredServer(raw: string): AuctionServer {
  try {
    return JSON.parse(raw) as AuctionServer;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Stored auction server payload is not valid JSON (schema drift or DB corruption): ${detail}`,
      { cause: err }
    );
  }
}

export function saveAuctionCache(
  db: Database.Database,
  currency: string,
  cached: CachedAuctionData
): void {
  db.prepare(
    `INSERT INTO auction_cache
      (currency, data, fetched_at, source, stale, updated_at, url)
     VALUES
      (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(currency) DO UPDATE SET
      data = excluded.data,
      fetched_at = excluded.fetched_at,
      source = excluded.source,
      stale = excluded.stale,
      updated_at = excluded.updated_at,
      url = excluded.url`
  ).run(
    currency,
    JSON.stringify(cached.data),
    cached.metadata.fetchedAt,
    cached.metadata.source,
    cached.metadata.stale ? 1 : 0,
    cached.metadata.updatedAt ?? null,
    cached.metadata.url
  );
}

export function getAuctionCache(
  db: Database.Database,
  currency: string
): CachedAuctionData | null {
  const row = db
    .prepare(
      "SELECT data, fetched_at, source, stale, updated_at, url FROM auction_cache WHERE currency = ?"
    )
    .get(currency) as
    | {
        data: string;
        fetched_at: string;
        source: string;
        stale: number;
        updated_at: string | null;
        url: string;
      }
    | undefined;

  if (row === undefined) {
    return null;
  }

  const updatedAt = row.updated_at ?? row.fetched_at;
  const updatedTime = Date.parse(updatedAt);
  const ageSeconds = Number.isNaN(updatedTime)
    ? undefined
    : Math.max(0, Math.floor((Date.now() - updatedTime) / 1000));

  let parsed: CachedAuctionData["data"];
  try {
    parsed = JSON.parse(row.data) as CachedAuctionData["data"];
  } catch {
    return null;
  }

  return {
    data: parsed,
    metadata: {
      ageSeconds,
      fetchedAt: row.fetched_at,
      source: "local-cache",
      stale: true,
      updatedAt,
      url: row.url,
    },
  };
}

export function pruneSnapshots(
  db: Database.Database,
  currency: string,
  keepCount = 50
): number {
  const result = db
    .prepare(
      `DELETE FROM snapshots
        WHERE currency = ?
          AND id NOT IN (
            SELECT id FROM snapshots
            WHERE currency = ?
            ORDER BY id DESC
            LIMIT ?
          )`
    )
    .run(currency, currency, keepCount);

  return result.changes;
}
