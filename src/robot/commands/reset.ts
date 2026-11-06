import { confirm, select } from "@inquirer/prompts";
import { type Command, Option } from "commander";
import {
  error as fmtError,
  formatJson,
  warning,
} from "../../shared/formatter.js";
import {
  type ActionOptions,
  asyncAction,
  output,
} from "../../shared/helpers.js";
import { formatResetOptions, formatResetResult } from "../formatter.js";
import type { ResetType } from "../types.js";

export function registerResetCommands(parent: Command): void {
  const reset = parent.command("reset").description("Server reset operations");

  reset
    .command("options [server]")
    .description("Show reset options for server(s)")
    .action(
      asyncAction(
        async (
          client,
          serverIdOrIp: string | undefined,
          options: ActionOptions
        ) => {
          if (serverIdOrIp) {
            const { reset: rst } = await client.getResetOptions(serverIdOrIp);
            output(rst, formatResetOptions, options);
          } else {
            const resets = await client.listResetOptions();
            if (options.json) {
              console.log(formatJson(resets));
            } else {
              for (const { reset: rst } of resets) {
                console.log(formatResetOptions(rst));
                console.log("");
              }
            }
          }
        }
      )
    );

  reset
    .command("execute <servers...>")
    .alias("run")
    .description("Reset one or more servers")
    .addOption(
      new Option("-t, --type <type>", "Reset type")
        .choices(["sw", "hw", "man", "power", "power_long"])
        .default("sw")
    )
    .option("-i, --interactive", "Interactively select reset type")
    .option("-y, --yes", "Skip confirmation")
    .action(
      asyncAction(
        async (
          client,
          servers: string[],
          options: { type: ResetType; interactive?: boolean; yes?: boolean }
        ) => {
          let resetType = options.type;

          if (options.interactive) {
            resetType = await select({
              message: "Select reset type:",
              choices: [
                { value: "sw", name: "Software reset (ACPI) - Recommended" },
                { value: "hw", name: "Hardware reset (forced)" },
                { value: "power", name: "Power cycle" },
                { value: "power_long", name: "Long power cycle (10+ seconds)" },
                { value: "man", name: "Manual reset (technician)" },
              ],
            });
          }

          if (!options.yes) {
            console.log("");
            console.log(
              warning(
                `About to reset ${servers.length} server(s) with type: ${resetType}`
              )
            );
            console.log(`Servers: ${servers.join(", ")}`);
            console.log("");

            const confirmed = await confirm({
              message: "Are you sure you want to proceed?",
              default: false,
            });

            if (!confirmed) {
              console.log("Aborted.");
              return;
            }
          }

          console.log("");
          for (const srv of servers) {
            try {
              const { reset: rst } = await client.resetServer(srv, resetType);
              console.log(formatResetResult(rst, resetType));
            } catch (error) {
              console.log(
                fmtError(
                  `Failed to reset ${srv}: ${error instanceof Error ? error.message : "Unknown error"}`
                )
              );
            }
          }
        }
      )
    );
}
