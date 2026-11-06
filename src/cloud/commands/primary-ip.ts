import type { Command } from "commander";
import { success } from "../../shared/formatter.js";
import { confirmAction, output } from "../../shared/helpers.js";
import { formatPrimaryIpDetails, formatPrimaryIpList } from "../formatter.js";
import {
  type CloudActionOptions,
  cloudAction,
  resolveIdOrName,
} from "../helpers.js";

export function registerPrimaryIpCommands(parent: Command): void {
  const pip = parent.command("primary-ip").description("Primary IP management");

  pip
    .command("list")
    .alias("ls")
    .description("List all primary IPs")
    .option("-l, --label-selector <selector>", "Label selector")
    .action(
      cloudAction(
        async (
          client,
          options: CloudActionOptions & { labelSelector?: string }
        ) => {
          const ips = await client.listPrimaryIps({
            label_selector: options.labelSelector,
          });
          output(ips, formatPrimaryIpList, options);
        }
      )
    );

  pip
    .command("describe <id-or-name>")
    .description("Show primary IP details")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(idOrName, "primary IP", (name) =>
            client.listPrimaryIps({ name })
          );
          const ip = await client.getPrimaryIp(id);
          output(ip, formatPrimaryIpDetails, options);
        }
      )
    );

  pip
    .command("create")
    .description("Create a primary IP")
    .requiredOption("--type <type>", "IP type (ipv4, ipv6)")
    .requiredOption("--name <name>", "Name")
    .option(
      "--location <location>",
      "Location, e.g. fsn1 (required unless --assignee-id is set)"
    )
    .option("--assignee-id <id>", "Server to assign to")
    .option("--auto-delete", "Auto-delete with server")
    .action(
      cloudAction(
        async (
          client,
          options: CloudActionOptions & {
            type: string;
            name: string;
            location?: string;
            assigneeId?: string;
            autoDelete?: boolean;
          }
        ) => {
          const { primary_ip: ip } = await client.createPrimaryIp({
            type: options.type as "ipv4" | "ipv6",
            name: options.name,
            assignee_type: "server",
            location: options.location,
            assignee_id: options.assigneeId
              ? Number.parseInt(options.assigneeId, 10)
              : undefined,
            auto_delete: options.autoDelete,
          });
          console.log(
            success(`Primary IP created (ID: ${ip.id}, IP: ${ip.ip})`)
          );
        }
      )
    );

  pip
    .command("delete <id-or-name>")
    .description("Delete a primary IP")
    .option("-y, --yes", "Skip confirmation")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(idOrName, "primary IP", (name) =>
            client.listPrimaryIps({ name })
          );
          const ip = await client.getPrimaryIp(id);
          if (
            !(await confirmAction(
              `Delete primary IP '${ip.name}' (ID: ${id})?`,
              options
            ))
          ) {
            return;
          }
          await client.deletePrimaryIp(id);
          console.log(success(`Primary IP '${ip.name}' (ID: ${id}) deleted.`));
        }
      )
    );

  pip
    .command("update <id-or-name>")
    .description("Update primary IP")
    .option("--name <name>", "New name")
    .option("--auto-delete <bool>", "Auto-delete with server (true/false)")
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          options: CloudActionOptions & { name?: string; autoDelete?: string }
        ) => {
          const id = await resolveIdOrName(idOrName, "primary IP", (name) =>
            client.listPrimaryIps({ name })
          );
          await client.updatePrimaryIp(id, {
            name: options.name,
            auto_delete: options.autoDelete
              ? options.autoDelete === "true"
              : undefined,
          });
          console.log(success(`Primary IP ${id} updated.`));
        }
      )
    );

  pip
    .command("assign <id-or-name> <server>")
    .description("Assign primary IP to server")
    .action(
      cloudAction(async (client, idOrName: string, server: string) => {
        const id = await resolveIdOrName(idOrName, "primary IP", (name) =>
          client.listPrimaryIps({ name })
        );
        await client.assignPrimaryIp(id, Number.parseInt(server, 10));
        console.log(success(`Primary IP ${id} assigned to server ${server}.`));
      })
    );

  pip
    .command("unassign <id-or-name>")
    .description("Unassign primary IP")
    .action(
      cloudAction(async (client, idOrName: string) => {
        const id = await resolveIdOrName(idOrName, "primary IP", (name) =>
          client.listPrimaryIps({ name })
        );
        await client.unassignPrimaryIp(id);
        console.log(success(`Primary IP ${id} unassigned.`));
      })
    );

  pip
    .command("enable-protection <id-or-name>")
    .description("Enable delete protection")
    .action(
      cloudAction(async (client, idOrName: string) => {
        const id = await resolveIdOrName(idOrName, "primary IP", (name) =>
          client.listPrimaryIps({ name })
        );
        await client.changePrimaryIpProtection(id, true);
        console.log(success(`Protection enabled for primary IP ${id}.`));
      })
    );

  pip
    .command("disable-protection <id-or-name>")
    .description("Disable delete protection")
    .action(
      cloudAction(async (client, idOrName: string) => {
        const id = await resolveIdOrName(idOrName, "primary IP", (name) =>
          client.listPrimaryIps({ name })
        );
        await client.changePrimaryIpProtection(id, false);
        console.log(success(`Protection disabled for primary IP ${id}.`));
      })
    );

  pip
    .command("set-rdns <id-or-name>")
    .description("Set reverse DNS")
    .requiredOption("--ip <ip>", "IP address")
    .requiredOption("--dns-ptr <ptr>", "DNS pointer (empty to reset)")
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          options: CloudActionOptions & { ip: string; dnsPtr: string }
        ) => {
          const id = await resolveIdOrName(idOrName, "primary IP", (name) =>
            client.listPrimaryIps({ name })
          );
          await client.changePrimaryIpDnsPtr(
            id,
            options.ip,
            options.dnsPtr || null
          );
          console.log(success("rDNS updated."));
        }
      )
    );

  pip
    .command("add-label <id-or-name> <label>")
    .description("Add a label (key=value)")
    .action(
      cloudAction(async (client, idOrName: string, label: string) => {
        const id = await resolveIdOrName(idOrName, "primary IP", (name) =>
          client.listPrimaryIps({ name })
        );
        const ip = await client.getPrimaryIp(id);
        const [key, value] = label.split("=");
        await client.updatePrimaryIp(id, {
          labels: { ...ip.labels, [key]: value || "" },
        });
        console.log(success(`Label '${key}' added.`));
      })
    );

  pip
    .command("remove-label <id-or-name> <key>")
    .description("Remove a label")
    .action(
      cloudAction(async (client, idOrName: string, key: string) => {
        const id = await resolveIdOrName(idOrName, "primary IP", (name) =>
          client.listPrimaryIps({ name })
        );
        const ip = await client.getPrimaryIp(id);
        const labels = Object.fromEntries(
          Object.entries(ip.labels).filter(([k]) => k !== key)
        );
        await client.updatePrimaryIp(id, { labels });
        console.log(success(`Label '${key}' removed.`));
      })
    );
}
