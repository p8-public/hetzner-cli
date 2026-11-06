import type { Command } from "commander";
import { success } from "../../shared/formatter.js";
import {
  type ActionOptions,
  asyncAction,
  confirmAction,
  output,
} from "../../shared/helpers.js";
import {
  formatVSwitchDetails,
  formatVSwitchList,
  formatVSwitchServers,
} from "../formatter.js";

const DIGITS_ONLY_REGEX = /^\d+$/;

function parseVSwitchId(value: string): number {
  if (!DIGITS_ONLY_REGEX.test(value)) {
    throw new Error(`Invalid vSwitch ID: ${value}`);
  }
  return Number.parseInt(value, 10);
}

export function registerVSwitchCommands(parent: Command): void {
  const vswitch = parent.command("vswitch").description("vSwitch management");

  vswitch
    .command("list")
    .alias("ls")
    .description("List all vSwitches")
    .action(
      asyncAction(async (client, options: ActionOptions) => {
        const vswitches = await client.listVSwitches();
        output(vswitches, formatVSwitchList, options);
      })
    );

  vswitch
    .command("get <id>")
    .alias("show")
    .description("Get vSwitch details")
    .action(
      asyncAction(async (client, vswitchId: string, options: ActionOptions) => {
        const vs = await client.getVSwitch(Number.parseInt(vswitchId, 10));
        output(vs, formatVSwitchDetails, options);
      })
    );

  vswitch
    .command("servers [id]")
    .description("List servers attached to all vSwitches, or to one vSwitch")
    .action(
      asyncAction(
        async (
          client,
          vswitchId: string | undefined,
          options: ActionOptions
        ) => {
          const vswitches =
            vswitchId === undefined
              ? await client.listVSwitchesWithServers()
              : [await client.getVSwitch(parseVSwitchId(vswitchId))];
          output(
            await client.addVSwitchServerNames(vswitches),
            formatVSwitchServers,
            options
          );
        }
      )
    );

  vswitch
    .command("create <name> <vlan>")
    .description("Create a new vSwitch")
    .action(
      asyncAction(async (client, name: string, vlan: string) => {
        const vs = await client.createVSwitch(name, Number.parseInt(vlan, 10));
        console.log(success(`vSwitch created: ID ${vs.id}`));
      })
    );

  vswitch
    .command("update <id>")
    .description("Update vSwitch")
    .option("-n, --name <name>", "New name")
    .option("-v, --vlan <vlan>", "New VLAN ID")
    .action(
      asyncAction(
        async (
          client,
          vswitchId: string,
          options: { name?: string; vlan?: string }
        ) => {
          await client.updateVSwitch(
            Number.parseInt(vswitchId, 10),
            options.name,
            options.vlan ? Number.parseInt(options.vlan, 10) : undefined
          );
          console.log(success("vSwitch updated."));
        }
      )
    );

  vswitch
    .command("delete <id>")
    .alias("rm")
    .description("Delete vSwitch")
    .option("-y, --yes", "Skip confirmation")
    .option("--date <date>", "Cancellation date (YYYY-MM-DD)")
    .action(
      asyncAction(
        async (
          client,
          vswitchId: string,
          options: ActionOptions & { date?: string }
        ) => {
          if (!(await confirmAction(`Delete vSwitch ${vswitchId}?`, options))) {
            return;
          }
          await client.deleteVSwitch(
            Number.parseInt(vswitchId, 10),
            options.date
          );
          console.log(success("vSwitch deleted."));
        }
      )
    );

  vswitch
    .command("add-server <vswitch-id> <server>")
    .description("Add server to vSwitch")
    .action(
      asyncAction(async (client, vswitchId: string, serverIdOrIp: string) => {
        await client.addServerToVSwitch(
          Number.parseInt(vswitchId, 10),
          serverIdOrIp
        );
        console.log(success("Server added to vSwitch."));
      })
    );

  vswitch
    .command("remove-server <vswitch-id> <server>")
    .description("Remove server from vSwitch")
    .action(
      asyncAction(async (client, vswitchId: string, serverIdOrIp: string) => {
        await client.removeServerFromVSwitch(
          Number.parseInt(vswitchId, 10),
          serverIdOrIp
        );
        console.log(success("Server removed from vSwitch."));
      })
    );
}
