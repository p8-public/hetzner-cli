import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { HetznerCloudClient } from "./client.js";

const CONFIG_DIR = join(homedir(), ".hctl");
const CONTEXTS_FILE = join(CONFIG_DIR, "cloud-contexts.json");
const LEGACY_CONTEXTS_FILE = join(
  homedir(),
  ".hetzner-cli",
  "cloud-contexts.json"
);
const KEYCHAIN_SERVICE = "hctl";
const LEGACY_KEYCHAIN_SERVICE = "hetzner-cli";

// Lazy-loaded keytar module
let keytarModule: typeof import("keytar") | null = null;
let keytarLoadAttempted = false;

async function getKeytar(): Promise<typeof import("keytar") | null> {
  if (keytarLoadAttempted) {
    return keytarModule;
  }
  keytarLoadAttempted = true;
  try {
    keytarModule = await import("keytar");
    return keytarModule;
  } catch {
    return null;
  }
}

interface ContextEntry {
  name: string;
  token?: string; // Only stored here if keytar unavailable
}

interface ContextsConfig {
  active: string | null;
  contexts: Record<string, ContextEntry>;
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function loadContexts(): ContextsConfig {
  const file = existsSync(CONTEXTS_FILE) ? CONTEXTS_FILE : LEGACY_CONTEXTS_FILE;
  if (!existsSync(file)) {
    return { active: null, contexts: {} };
  }
  try {
    const data = readFileSync(file, "utf-8");
    return JSON.parse(data) as ContextsConfig;
  } catch {
    return { active: null, contexts: {} };
  }
}

function saveContexts(config: ContextsConfig): void {
  ensureConfigDir();
  writeFileSync(CONTEXTS_FILE, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

function keychainAccount(contextName: string): string {
  return `cloud-token:${contextName}`;
}

async function storeToken(
  contextName: string,
  token: string
): Promise<boolean> {
  const keytar = await getKeytar();
  if (keytar) {
    try {
      await keytar.setPassword(
        KEYCHAIN_SERVICE,
        keychainAccount(contextName),
        token
      );
      return true;
    } catch {
      // Fall through to file storage
    }
  }
  console.warn(
    "Warning: System keychain unavailable. Cloud token will be stored in plaintext at ~/.hctl/cloud-contexts.json"
  );
  return false;
}

async function retrieveToken(contextName: string): Promise<string | null> {
  // Try keytar first
  const keytar = await getKeytar();
  if (keytar) {
    try {
      const token =
        (await keytar.getPassword(
          KEYCHAIN_SERVICE,
          keychainAccount(contextName)
        )) ??
        (await keytar.getPassword(
          LEGACY_KEYCHAIN_SERVICE,
          keychainAccount(contextName)
        ));
      if (token) {
        return token;
      }
    } catch {
      // Fall through
    }
  }

  // Fall back to file
  const config = loadContexts();
  return config.contexts[contextName]?.token ?? null;
}

async function deleteToken(contextName: string): Promise<void> {
  const keytar = await getKeytar();
  if (keytar) {
    try {
      await keytar.deletePassword(
        KEYCHAIN_SERVICE,
        keychainAccount(contextName)
      );
      await keytar.deletePassword(
        LEGACY_KEYCHAIN_SERVICE,
        keychainAccount(contextName)
      );
    } catch {
      // Ignore
    }
  }
}

/**
 * Create a new cloud context.
 */
export async function createContext(
  name: string,
  token: string,
  options: { verify?: boolean } = {}
): Promise<void> {
  if (options.verify !== false) {
    await validateCloudToken(token);
  }

  const config = loadContexts();

  const storedInKeychain = await storeToken(name, token);

  config.contexts[name] = {
    name,
    ...(storedInKeychain ? {} : { token }),
  };

  // Auto-activate if first context
  if (!config.active) {
    config.active = name;
  }

  saveContexts(config);
}

/**
 * Set the active context.
 */
export function useContext(name: string): void {
  const config = loadContexts();
  if (!config.contexts[name]) {
    throw new Error(
      `Context '${name}' not found. Use 'hctl cloud context list' to see available contexts.`
    );
  }
  config.active = name;
  saveContexts(config);
}

/**
 * Delete a context.
 */
export async function deleteContext(name: string): Promise<void> {
  const config = loadContexts();
  if (!config.contexts[name]) {
    throw new Error(`Context '${name}' not found.`);
  }

  await deleteToken(name);
  const { [name]: _, ...rest } = config.contexts;
  config.contexts = rest;

  if (config.active === name) {
    const remaining = Object.keys(config.contexts);
    config.active = remaining.length > 0 ? remaining[0] : null;
  }

  saveContexts(config);
}

/**
 * List all contexts.
 */
export function listContexts(): { name: string; active: boolean }[] {
  const config = loadContexts();
  return Object.values(config.contexts).map((ctx) => ({
    name: ctx.name,
    active: ctx.name === config.active,
  }));
}

/**
 * Get the active context name.
 */
export function getActiveContext(): string | null {
  const config = loadContexts();
  return config.active;
}

/**
 * Resolve the cloud API token.
 * Priority: --token flag > HETZNER_CLOUD_TOKEN env > active context
 */
export async function resolveToken(flagToken?: string): Promise<string> {
  // 1. CLI flag
  if (flagToken) {
    return flagToken;
  }

  // 2. Environment variable
  const envToken = process.env.HETZNER_CLOUD_TOKEN;
  if (envToken) {
    return envToken;
  }

  // 3. Active context
  const config = loadContexts();
  if (config.active) {
    const token = await retrieveToken(config.active);
    if (token) {
      return token;
    }
  }

  throw new Error(
    "No cloud token found. Use one of:\n" +
      "  --token <token>                  Pass token directly\n" +
      "  HETZNER_CLOUD_TOKEN=<token>      Set environment variable\n" +
      "  hctl cloud context create     Configure a named context"
  );
}

/**
 * Validate that a token authenticates against the Hetzner Cloud API.
 */
export async function validateCloudToken(token: string): Promise<void> {
  if (!token.trim()) {
    throw new Error("Cloud token is empty.");
  }

  const client = new HetznerCloudClient(token);
  try {
    await client.listLocations();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const normalizedMessage = message.toLowerCase();
    if (
      normalizedMessage.includes("401") ||
      normalizedMessage.includes("unauthorized")
    ) {
      throw new Error(
        "Hetzner Cloud token validation failed: api.hetzner.cloud rejected this token. Create a project API token in the Hetzner Cloud Console; Robot credentials, console logins, Cloudflare tokens, DNS tokens, and R2 tokens will not work.",
        { cause: error }
      );
    }
    if (
      normalizedMessage.includes("403") ||
      normalizedMessage.includes("forbidden")
    ) {
      throw new Error(
        "Hetzner Cloud token validation failed: this token authenticated but cannot read Cloud API resources.",
        { cause: error }
      );
    }
    throw new Error(`Hetzner Cloud token validation failed: ${message}`, {
      cause: error,
    });
  }
}
