import { readFileSync } from "node:fs";
import { confirm } from "@inquirer/prompts";
import type { Command, OptionValues } from "commander";

import { HetznerRobotClient } from "../robot/client.js";
import { requireCredentials } from "./config.js";
import { error as fmtError, formatJson } from "./formatter.js";

export interface ActionOptions {
  json?: boolean;
  password?: string;
  user?: string;
  yes?: boolean;
}

/**
 * Handle errors from action wrappers consistently.
 * Exits with code 0 for user-initiated prompt exits, code 1 for all other errors.
 */
export function handleActionError(err: unknown): never {
  if (err instanceof Error) {
    if (
      err.message.includes("ExitPromptError") ||
      err.name === "ExitPromptError"
    ) {
      process.exit(0);
    }
    console.error(fmtError(err.message));
  } else {
    console.error(fmtError("An unknown error occurred"));
  }
  process.exit(1);
}

/**
 * Split the arguments Commander passes to an action handler, which are
 * `(...positionals, localOptions, command)`.
 *
 * Flags such as --json are declared on ancestor commands, so they are missing
 * from `localOptions`. The returned `handlerArgs` carry the merged options in
 * that slot instead.
 */
export function resolveActionArgs(args: unknown[]): {
  handlerArgs: unknown[];
  options: OptionValues;
} {
  const command = args.at(-1) as Command;
  const options = command.optsWithGlobals();
  return { handlerArgs: [...args.slice(0, -2), options], options };
}

export function asyncAction<T extends unknown[]>(
  fn: (client: HetznerRobotClient, ...args: T) => Promise<void>
): (...args: [...T, ...unknown[]]) => Promise<void> {
  return async (...args) => {
    const { handlerArgs, options: merged } = resolveActionArgs(args);
    const options: ActionOptions = merged;
    try {
      const { user } = options;
      let password = options.password;

      if (password === "-") {
        try {
          password = readFileSync(0, "utf-8").trim();
        } catch {
          throw new Error("Failed to read password from stdin");
        }
      }

      let apiClient: HetznerRobotClient;
      if (user && password) {
        apiClient = new HetznerRobotClient(user, password);
      } else {
        const creds = await requireCredentials();
        apiClient = new HetznerRobotClient(creds.user, creds.password);
      }

      await fn(apiClient, ...(handlerArgs as T));
    } catch (error) {
      handleActionError(error);
    }
  };
}

/**
 * Output data as JSON or formatted table based on options.
 */
export function output<T>(
  data: T,
  formatter: (data: T) => string,
  options: { json?: boolean }
): void {
  console.log(options.json ? formatJson(data) : formatter(data));
}

/**
 * Confirm destructive action unless --yes flag is set.
 * Returns true if confirmed, false if aborted.
 */
export async function confirmAction(
  message: string,
  options: { yes?: boolean },
  defaultValue = false
): Promise<boolean> {
  if (options.yes) {
    return true;
  }
  const confirmed = await confirm({ message, default: defaultValue });
  if (!confirmed) {
    console.log("Aborted.");
    return false;
  }
  return true;
}
