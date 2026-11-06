import type { Command } from "commander";
import { colorize, info, success } from "../../shared/formatter.js";
import { confirmAction, output } from "../../shared/helpers.js";
import type { HetznerCloudClient } from "../client.js";
import {
  formatCloudServerDetails,
  formatCloudServerList,
} from "../formatter.js";
import {
  type CloudActionOptions,
  cloudAction,
  parseLabels,
  resolveIdOrName,
} from "../helpers.js";

function resolveServerId(client: HetznerCloudClient, idOrName: string) {
  return resolveIdOrName(idOrName, "server", (name) =>
    client.listServers({ name })
  );
}

async function handleServerList(
  client: HetznerCloudClient,
  options: CloudActionOptions & {
    labelSelector?: string;
    name?: string;
    sort?: string;
    status?: string;
  }
) {
  const servers = await client.listServers({
    label_selector: options.labelSelector,
    name: options.name,
    sort: options.sort,
    status: options.status,
  });
  output(servers, formatCloudServerList, options);
}

async function handleServerDescribe(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions
) {
  const id = await resolveServerId(client, idOrName);
  const srv = await client.getServer(id);
  output(srv, formatCloudServerDetails, options);
}

async function handleServerCreate(
  client: HetznerCloudClient,
  options: CloudActionOptions & {
    name: string;
    type: string;
    image: string;
    location?: string;
    sshKey?: string[];
    userData?: string;
    labels?: string;
    firewall?: string[];
    placementGroup?: string;
    startAfterCreate?: boolean;
  }
) {
  const result = await client.createServer({
    name: options.name,
    server_type: options.type,
    image: options.image,
    location: options.location,
    ssh_keys: options.sshKey,
    user_data: options.userData,
    labels: options.labels ? parseLabels(options.labels) : undefined,
    firewalls: options.firewall?.map((id) => ({
      firewall: Number.parseInt(id, 10),
    })),
    placement_group: options.placementGroup
      ? Number.parseInt(options.placementGroup, 10)
      : undefined,
    start_after_create: options.startAfterCreate,
  });
  console.log(
    success(`Server '${result.server.name}' created (ID: ${result.server.id})`)
  );
  if (result.root_password) {
    console.log(`Root password: ${colorize(result.root_password, "yellow")}`);
  }
  console.log(info(`IPv4: ${result.server.public_net.ipv4?.ip || "pending"}`));
}

async function handleServerDelete(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions
) {
  const id = await resolveServerId(client, idOrName);
  const srv = await client.getServer(id);
  if (
    !(await confirmAction(`Delete server '${srv.name}' (ID: ${id})?`, options))
  ) {
    return;
  }
  await client.deleteServer(id);
  console.log(success(`Server '${srv.name}' (ID: ${id}) deleted.`));
}

async function handleServerUpdate(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & { name?: string }
) {
  const id = await resolveServerId(client, idOrName);
  const { server: srv } = await client.updateServer(id, {
    name: options.name,
  });
  console.log(success(`Server '${srv.name}' updated.`));
}

async function handleServerPoweron(
  client: HetznerCloudClient,
  idOrName: string
) {
  const id = await resolveServerId(client, idOrName);
  await client.powerOnServer(id);
  console.log(success(`Server ${id} powered on.`));
}

async function handleServerPoweroff(
  client: HetznerCloudClient,
  idOrName: string
) {
  const id = await resolveServerId(client, idOrName);
  await client.powerOffServer(id);
  console.log(success(`Server ${id} powered off.`));
}

async function handleServerReboot(
  client: HetznerCloudClient,
  idOrName: string
) {
  const id = await resolveServerId(client, idOrName);
  await client.rebootServer(id);
  console.log(success(`Server ${id} rebooted.`));
}

async function handleServerReset(client: HetznerCloudClient, idOrName: string) {
  const id = await resolveServerId(client, idOrName);
  await client.resetServer(id);
  console.log(success(`Server ${id} reset.`));
}

async function handleServerShutdown(
  client: HetznerCloudClient,
  idOrName: string
) {
  const id = await resolveServerId(client, idOrName);
  await client.shutdownServer(id);
  console.log(success(`Server ${id} shutdown initiated.`));
}

async function handleServerRebuild(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & { image: string }
) {
  const id = await resolveServerId(client, idOrName);
  const result = await client.rebuildServer(id, options.image);
  console.log(success(`Server ${id} rebuilding.`));
  if (result.root_password) {
    console.log(`Root password: ${colorize(result.root_password, "yellow")}`);
  }
}

async function handleServerChangeType(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & { type: string; upgradeDisk?: boolean }
) {
  const id = await resolveServerId(client, idOrName);
  await client.changeServerType(id, options.type, !!options.upgradeDisk);
  console.log(success(`Server ${id} type change initiated.`));
}

async function handleServerEnableRescue(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & { type: string; sshKey?: string[] }
) {
  const id = await resolveServerId(client, idOrName);
  const result = await client.enableServerRescue(
    id,
    options.type,
    options.sshKey?.map(Number)
  );
  console.log(success("Rescue mode enabled."));
  console.log(`Root password: ${colorize(result.root_password, "yellow")}`);
}

async function handleServerDisableRescue(
  client: HetznerCloudClient,
  idOrName: string
) {
  const id = await resolveServerId(client, idOrName);
  await client.disableServerRescue(id);
  console.log(success("Rescue mode disabled."));
}

async function handleServerEnableBackup(
  client: HetznerCloudClient,
  idOrName: string
) {
  const id = await resolveServerId(client, idOrName);
  await client.enableServerBackup(id);
  console.log(success(`Backups enabled for server ${id}.`));
}

async function handleServerDisableBackup(
  client: HetznerCloudClient,
  idOrName: string
) {
  const id = await resolveServerId(client, idOrName);
  await client.disableServerBackup(id);
  console.log(success(`Backups disabled for server ${id}.`));
}

async function handleServerCreateImage(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & { description?: string; type?: string }
) {
  const id = await resolveServerId(client, idOrName);
  const result = await client.createServerImage(id, {
    description: options.description,
    type: options.type as "snapshot" | "backup",
  });
  console.log(success(`Image created (ID: ${result.image.id})`));
}

async function handleServerAttachIso(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & { iso: string }
) {
  const id = await resolveServerId(client, idOrName);
  await client.attachIsoToServer(id, options.iso);
  console.log(success(`ISO attached to server ${id}.`));
}

async function handleServerDetachIso(
  client: HetznerCloudClient,
  idOrName: string
) {
  const id = await resolveServerId(client, idOrName);
  await client.detachIsoFromServer(id);
  console.log(success(`ISO detached from server ${id}.`));
}

async function handleServerResetPassword(
  client: HetznerCloudClient,
  idOrName: string
) {
  const id = await resolveServerId(client, idOrName);
  const result = await client.resetServerPassword(id);
  console.log(success("Root password reset."));
  console.log(`New password: ${colorize(result.root_password, "yellow")}`);
}

async function handleServerSetRdns(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & { ip: string; dnsPtr: string }
) {
  const id = await resolveServerId(client, idOrName);
  await client.setServerRdns(id, options.ip, options.dnsPtr);
  console.log(success(`rDNS set: ${options.ip} -> ${options.dnsPtr}`));
}

async function handleServerEnableProtection(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & { delete?: boolean; rebuild?: boolean }
) {
  const id = await resolveServerId(client, idOrName);
  await client.enableServerProtection(id, {
    delete: options.delete,
    rebuild: options.rebuild,
  });
  console.log(success(`Protection enabled for server ${id}.`));
}

async function handleServerDisableProtection(
  client: HetznerCloudClient,
  idOrName: string
) {
  const id = await resolveServerId(client, idOrName);
  await client.enableServerProtection(id, {
    delete: false,
    rebuild: false,
  });
  console.log(success(`Protection disabled for server ${id}.`));
}

async function handleServerRequestConsole(
  client: HetznerCloudClient,
  idOrName: string
) {
  const id = await resolveServerId(client, idOrName);
  const result = await client.requestServerConsole(id);
  console.log(success("Console ready."));
  console.log(`WebSocket URL: ${result.wss_url}`);
  console.log(`Password: ${colorize(result.password, "yellow")}`);
}

async function handleServerAttachToNetwork(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & { network: string; ip?: string }
) {
  const id = await resolveServerId(client, idOrName);
  await client.attachServerToNetwork(
    id,
    Number.parseInt(options.network, 10),
    options.ip
  );
  console.log(success(`Server ${id} attached to network ${options.network}.`));
}

async function handleServerDetachFromNetwork(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & { network: string }
) {
  const id = await resolveServerId(client, idOrName);
  await client.detachServerFromNetwork(
    id,
    Number.parseInt(options.network, 10)
  );
  console.log(
    success(`Server ${id} detached from network ${options.network}.`)
  );
}

async function handleServerAddLabel(
  client: HetznerCloudClient,
  idOrName: string,
  label: string
) {
  const id = await resolveServerId(client, idOrName);
  const srv = await client.getServer(id);
  const [key, value] = label.split("=");
  const labels = { ...srv.labels, [key]: value || "" };
  await client.updateServer(id, { labels });
  console.log(success(`Label '${key}' added to server ${id}.`));
}

async function handleServerRemoveLabel(
  client: HetznerCloudClient,
  idOrName: string,
  key: string
) {
  const id = await resolveServerId(client, idOrName);
  const srv = await client.getServer(id);
  const labels = Object.fromEntries(
    Object.entries(srv.labels).filter(([k]) => k !== key)
  );
  await client.updateServer(id, { labels });
  console.log(success(`Label '${key}' removed from server ${id}.`));
}

export function registerCloudServerCommands(parent: Command): void {
  const server = parent
    .command("server")
    .description("Cloud server management");

  server
    .command("list")
    .alias("ls")
    .description("List all servers")
    .option("-l, --label-selector <selector>", "Label selector")
    .option("-n, --name <name>", "Filter by name")
    .option("-s, --sort <field>", "Sort by field")
    .option("--status <status>", "Filter by status")
    .action(cloudAction(handleServerList));

  server
    .command("describe <id-or-name>")
    .description("Show server details")
    .action(cloudAction(handleServerDescribe));

  server
    .command("create")
    .description("Create a new server")
    .requiredOption("--name <name>", "Server name")
    .requiredOption("--type <type>", "Server type")
    .requiredOption("--image <image>", "Image to use")
    .option("--location <location>", "Location")
    .option("--ssh-key <keys...>", "SSH key IDs or names")
    .option("--user-data <data>", "Cloud-init user data")
    .option("--labels <labels>", "Labels as key=value pairs (comma-separated)")
    .option("--firewall <ids...>", "Firewall IDs to apply")
    .option("--placement-group <id>", "Placement group ID")
    .option("--start-after-create", "Start server after creation", true)
    .option("--no-start-after-create", "Do not start server after creation")
    .action(cloudAction(handleServerCreate));

  server
    .command("delete <id-or-name>")
    .description("Delete a server")
    .option("-y, --yes", "Skip confirmation")
    .action(cloudAction(handleServerDelete));

  server
    .command("update <id-or-name>")
    .description("Update server")
    .option("--name <name>", "New name")
    .action(cloudAction(handleServerUpdate));

  server
    .command("poweron <id-or-name>")
    .description("Power on a server")
    .action(cloudAction(handleServerPoweron));

  server
    .command("poweroff <id-or-name>")
    .description("Power off a server (hard)")
    .action(cloudAction(handleServerPoweroff));

  server
    .command("reboot <id-or-name>")
    .description("Soft reboot a server")
    .action(cloudAction(handleServerReboot));

  server
    .command("reset <id-or-name>")
    .description("Hard reset a server")
    .action(cloudAction(handleServerReset));

  server
    .command("shutdown <id-or-name>")
    .description("Gracefully shutdown a server (ACPI)")
    .action(cloudAction(handleServerShutdown));

  server
    .command("rebuild <id-or-name>")
    .description("Rebuild a server with a new image")
    .requiredOption("--image <image>", "Image to rebuild with")
    .action(cloudAction(handleServerRebuild));

  server
    .command("change-type <id-or-name>")
    .description("Change server type (resize)")
    .requiredOption("--type <type>", "New server type")
    .option("--upgrade-disk", "Upgrade disk size (irreversible)", false)
    .action(cloudAction(handleServerChangeType));

  server
    .command("enable-rescue <id-or-name>")
    .description("Enable rescue mode")
    .option("--type <type>", "Rescue system type", "linux64")
    .option("--ssh-key <keys...>", "SSH key IDs")
    .action(cloudAction(handleServerEnableRescue));

  server
    .command("disable-rescue <id-or-name>")
    .description("Disable rescue mode")
    .action(cloudAction(handleServerDisableRescue));

  server
    .command("enable-backup <id-or-name>")
    .description("Enable automatic backups")
    .action(cloudAction(handleServerEnableBackup));

  server
    .command("disable-backup <id-or-name>")
    .description("Disable automatic backups")
    .action(cloudAction(handleServerDisableBackup));

  server
    .command("create-image <id-or-name>")
    .description("Create an image (snapshot) from server")
    .option("--description <desc>", "Image description")
    .option("--type <type>", "Image type (snapshot or backup)", "snapshot")
    .action(cloudAction(handleServerCreateImage));

  server
    .command("attach-iso <id-or-name>")
    .description("Attach an ISO to a server")
    .requiredOption("--iso <iso>", "ISO name or ID")
    .action(cloudAction(handleServerAttachIso));

  server
    .command("detach-iso <id-or-name>")
    .description("Detach ISO from a server")
    .action(cloudAction(handleServerDetachIso));

  server
    .command("reset-password <id-or-name>")
    .description("Reset server root password")
    .action(cloudAction(handleServerResetPassword));

  server
    .command("set-rdns <id-or-name>")
    .description("Set reverse DNS for server")
    .requiredOption("--ip <ip>", "IP address")
    .requiredOption("--dns-ptr <ptr>", "DNS pointer")
    .action(cloudAction(handleServerSetRdns));

  server
    .command("enable-protection <id-or-name>")
    .description("Enable server protection")
    .option("--delete", "Enable delete protection", true)
    .option("--rebuild", "Enable rebuild protection", false)
    .action(cloudAction(handleServerEnableProtection));

  server
    .command("disable-protection <id-or-name>")
    .description("Disable server protection")
    .action(cloudAction(handleServerDisableProtection));

  server
    .command("request-console <id-or-name>")
    .description("Request a WebSocket VNC console")
    .action(cloudAction(handleServerRequestConsole));

  server
    .command("attach-to-network <id-or-name>")
    .description("Attach server to a network")
    .requiredOption("--network <network>", "Network ID")
    .option("--ip <ip>", "IP address in network")
    .action(cloudAction(handleServerAttachToNetwork));

  server
    .command("detach-from-network <id-or-name>")
    .description("Detach server from a network")
    .requiredOption("--network <network>", "Network ID")
    .action(cloudAction(handleServerDetachFromNetwork));

  server
    .command("add-label <id-or-name> <label>")
    .description("Add a label (key=value)")
    .action(cloudAction(handleServerAddLabel));

  server
    .command("remove-label <id-or-name> <key>")
    .description("Remove a label by key")
    .action(cloudAction(handleServerRemoveLabel));
}
