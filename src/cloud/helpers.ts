import { readFileSync } from "node:fs";
import { handleActionError, resolveActionArgs } from "../shared/helpers.js";
import { HetznerCloudClient } from "./client.js";
import { resolveToken } from "./context.js";

const DIGITS_ONLY_REGEX = /^\d+$/;

export interface CloudActionOptions {
  json?: boolean;
  token?: string;
  yes?: boolean;
}

/**
 * Parse a comma-separated "key=value,key2=value2" string into a labels object.
 */
export function parseLabels(val: string): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const pair of val.split(",")) {
    const trimmed = pair.trim();
    if (!trimmed) {
      continue;
    }
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) {
      labels[trimmed] = "";
    } else {
      labels[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
  }
  return labels;
}

/**
 * Read and parse a JSON file, returning the parsed content.
 */
export function readJsonFile<T = unknown>(path: string): T {
  const content = readFileSync(path, "utf-8");
  return JSON.parse(content) as T;
}

/**
 * Resolve a numeric ID string or a resource name to a numeric ID.
 * If the input is purely digits, returns it directly without any API call.
 * Otherwise, calls the resolver to look up the name and expects exactly one match.
 */
export async function resolveIdOrName(
  idOrName: string,
  resourceType: string,
  resolver: (name: string) => Promise<{ id: number; name: string | null }[]>
): Promise<number> {
  if (DIGITS_ONLY_REGEX.test(idOrName)) {
    return Number.parseInt(idOrName, 10);
  }
  const matches = await resolver(idOrName);
  if (matches.length === 0) {
    throw new Error(`${resourceType} '${idOrName}' not found`);
  }
  if (matches.length > 1) {
    throw new Error(
      `Multiple ${resourceType}s match '${idOrName}' (IDs: ${matches.map((m) => m.id).join(", ")}). Use numeric ID instead.`
    );
  }
  return matches[0].id;
}

/**
 * Wrap a cloud API action with token resolution and error handling.
 */
export function cloudAction<T extends unknown[]>(
  fn: (client: HetznerCloudClient, ...args: T) => Promise<void>
): (...args: [...T, ...unknown[]]) => Promise<void> {
  return async (...args) => {
    const { handlerArgs, options: merged } = resolveActionArgs(args);
    const options: CloudActionOptions = merged;
    try {
      const token = await resolveToken(options.token);
      const client = new HetznerCloudClient(token);
      await fn(client, ...(handlerArgs as T));
    } catch (error) {
      handleActionError(error);
    }
  };
}
