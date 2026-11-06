import {
  colorize,
  createTable,
  formatBytes,
  formatDate,
  formatDateTime,
  formatStatus,
  heading,
  info,
  success,
} from "../shared/formatter.js";
import type {
  BootConfig,
  Cancellation,
  Failover,
  Firewall,
  FirewallTemplate,
  IP,
  LinuxConfig,
  Rdns,
  RescueConfig,
  Reset,
  Server,
  ServerDetails,
  ServerMarketProduct,
  ServerProduct,
  ServerTransaction,
  SshKey,
  StorageBox,
  StorageBoxSnapshot,
  StorageBoxSubaccount,
  Subnet,
  Traffic,
  VSwitch,
  VSwitchSummary,
  Wol,
} from "./types.js";

export function formatServerList(servers: { server: Server }[]): string {
  if (servers.length === 0) {
    return info("No servers found.");
  }

  const table = createTable([
    "#",
    "IP",
    "Name",
    "Product",
    "DC",
    "Status",
    "Paid Until",
  ]);

  for (const { server } of servers) {
    table.push([
      server.server_number.toString(),
      server.server_ip,
      server.server_name || "-",
      server.product,
      server.dc,
      formatStatus(server.status),
      server.cancelled
        ? colorize("Cancelled", "red")
        : formatDate(server.paid_until),
    ]);
  }

  return table.toString();
}

export function formatServerDetails(server: ServerDetails): string {
  const lines: string[] = [];

  lines.push(heading(`Server ${server.server_number}`));
  lines.push("");

  const table = createTable(["Property", "Value"]);
  table.push(
    ["Server Number", server.server_number.toString()],
    ["IPv4", server.server_ip],
    ["IPv6 Net", server.server_ipv6_net || "-"],
    ["Name", server.server_name || "-"],
    ["Product", server.product],
    ["Datacenter", server.dc],
    ["Traffic", server.traffic],
    ["Status", formatStatus(server.status)],
    ["Paid Until", formatDate(server.paid_until)],
    ["Cancelled", server.cancelled ? colorize("Yes", "red") : "No"]
  );

  lines.push(table.toString());

  // Features
  lines.push("");
  lines.push(colorize("Features:", "bold"));
  const features = [
    { name: "Reset", enabled: server.reset },
    { name: "Rescue", enabled: server.rescue },
    { name: "VNC", enabled: server.vnc },
    { name: "Windows", enabled: server.windows },
    { name: "Plesk", enabled: server.plesk },
    { name: "cPanel", enabled: server.cpanel },
    { name: "WoL", enabled: server.wol },
    { name: "Hot Swap", enabled: server.hot_swap },
  ];

  const enabledFeatures = features.filter((f) => f.enabled).map((f) => f.name);
  lines.push(
    enabledFeatures.length > 0 ? `  ${enabledFeatures.join(", ")}` : "  None"
  );

  // IPs
  if (server.ip && server.ip.length > 0) {
    lines.push("");
    lines.push(colorize("Additional IPs:", "bold"));
    for (const ip of server.ip) {
      lines.push(`  ${ip}`);
    }
  }

  // Subnets
  if (server.subnet && server.subnet.length > 0) {
    lines.push("");
    lines.push(colorize("Subnets:", "bold"));
    for (const subnet of server.subnet) {
      lines.push(`  ${subnet.ip}/${subnet.mask}`);
    }
  }

  return lines.join("\n");
}

export function formatResetOptions(reset: Reset): string {
  const lines: string[] = [];

  lines.push(heading(`Reset Options for Server ${reset.server_number}`));
  lines.push("");

  const table = createTable(["Property", "Value"]);
  table.push(
    ["Server IP", reset.server_ip],
    ["Server Number", reset.server_number.toString()],
    ["Operating Status", formatStatus(reset.operating_status)],
    ["Available Reset Types", reset.type.join(", ")]
  );

  lines.push(table.toString());
  lines.push("");
  lines.push(colorize("Reset Types:", "bold"));
  lines.push("  sw         - Software reset (ACPI)");
  lines.push("  hw         - Hardware reset (forced)");
  lines.push("  man        - Manual reset (technician)");
  lines.push("  power      - Power cycle");
  lines.push("  power_long - Long power cycle (10+ seconds)");

  return lines.join("\n");
}

export function formatResetResult(reset: Reset, type: string): string {
  return success(
    `Server ${reset.server_number} reset initiated (type: ${type})`
  );
}

function formatBootSection(
  label: string,
  active: boolean,
  password: string | null | undefined,
  extraLines?: string[]
): string[] {
  const lines: string[] = [];
  lines.push(colorize(`${label}:`, "bold"));
  lines.push(`  Active: ${active ? colorize("Yes", "green") : "No"}`);
  if (active && password) {
    lines.push(`  Password: ${password}`);
  }
  if (extraLines) {
    lines.push(...extraLines);
  }
  lines.push("");
  return lines;
}

export function formatBootConfig(
  config: BootConfig,
  serverNumber: number
): string {
  const lines: string[] = [];

  lines.push(heading(`Boot Configuration for Server ${serverNumber}`));
  lines.push("");

  if (config.rescue) {
    lines.push(
      ...formatBootSection(
        "Rescue System",
        config.rescue.active,
        config.rescue.password,
        [
          `  Available OS: ${config.rescue.os.join(", ")}`,
          `  Architectures: ${config.rescue.arch.join(", ")}-bit`,
        ]
      )
    );
  }

  if (config.linux) {
    const distSuffix = config.linux.dist.length > 5 ? "..." : "";
    lines.push(
      ...formatBootSection(
        "Linux Install",
        config.linux.active,
        config.linux.password,
        [
          `  Distributions: ${config.linux.dist.slice(0, 5).join(", ")}${distSuffix}`,
        ]
      )
    );
  }

  if (config.vnc) {
    lines.push(
      ...formatBootSection(
        "VNC Install",
        config.vnc.active,
        config.vnc.password
      )
    );
  }

  if (config.windows) {
    lines.push(
      ...formatBootSection(
        "Windows Install",
        config.windows.active,
        config.windows.password
      )
    );
  }

  return lines.join("\n");
}

export function formatRescueActivation(rescue: RescueConfig): string {
  const lines: string[] = [];

  lines.push(success("Rescue system activated"));
  lines.push("");
  lines.push(colorize("Connection Details:", "bold"));
  lines.push(`  Server: ${rescue.server_ip}`);
  if (rescue.password) {
    lines.push(`  Password: ${colorize(rescue.password, "yellow")}`);
  }
  lines.push("");
  lines.push(info("Reboot the server to enter rescue mode."));

  return lines.join("\n");
}

export function formatLinuxActivation(linux: LinuxConfig): string {
  const lines: string[] = [];

  lines.push(success("Linux installation activated"));
  lines.push("");
  lines.push(colorize("Installation Details:", "bold"));
  lines.push(`  Server: ${linux.server_ip}`);
  if (linux.password) {
    lines.push(`  Password: ${colorize(linux.password, "yellow")}`);
  }
  lines.push("");
  lines.push(info("Reboot the server to start installation."));

  return lines.join("\n");
}

export function formatIpList(ips: { ip: IP }[]): string {
  if (ips.length === 0) {
    return info("No IPs found.");
  }

  const table = createTable([
    "IP",
    "Server IP",
    "Server #",
    "Locked",
    "MAC",
    "Traffic Warnings",
  ]);

  for (const { ip } of ips) {
    table.push([
      ip.ip,
      ip.server_ip,
      ip.server_number.toString(),
      ip.locked ? colorize("Yes", "red") : "No",
      ip.separate_mac || "-",
      ip.traffic_warnings ? "Yes" : "No",
    ]);
  }

  return table.toString();
}

export function formatIpDetails(ip: IP): string {
  const table = createTable(["Property", "Value"]);

  table.push(
    ["IP Address", ip.ip],
    ["Server IP", ip.server_ip],
    ["Server Number", ip.server_number.toString()],
    ["Locked", ip.locked ? colorize("Yes", "red") : "No"],
    ["Separate MAC", ip.separate_mac || "-"],
    ["Traffic Warnings", ip.traffic_warnings ? "Enabled" : "Disabled"],
    ["Traffic Hourly", `${ip.traffic_hourly} MB`],
    ["Traffic Daily", `${ip.traffic_daily} MB`],
    ["Traffic Monthly", `${ip.traffic_monthly} GB`]
  );

  return table.toString();
}

export function formatSubnetList(subnets: { subnet: Subnet }[]): string {
  if (subnets.length === 0) {
    return info("No subnets found.");
  }

  const table = createTable([
    "Subnet",
    "Gateway",
    "Server IP",
    "Failover",
    "Locked",
  ]);

  for (const { subnet } of subnets) {
    table.push([
      `${subnet.ip}/${subnet.mask}`,
      subnet.gateway,
      subnet.server_ip,
      subnet.failover ? "Yes" : "No",
      subnet.locked ? colorize("Yes", "red") : "No",
    ]);
  }

  return table.toString();
}

export function formatFailoverList(
  failovers: { failover: Failover }[]
): string {
  if (failovers.length === 0) {
    return info("No failover IPs found.");
  }

  const table = createTable([
    "Failover IP",
    "Netmask",
    "Server IP",
    "Active Server",
  ]);

  for (const { failover } of failovers) {
    table.push([
      failover.ip,
      failover.netmask,
      failover.server_ip,
      failover.active_server_ip,
    ]);
  }

  return table.toString();
}

export function formatFailoverSwitch(failover: Failover): string {
  return success(
    `Failover ${failover.ip} routed to ${failover.active_server_ip}`
  );
}

export function formatRdnsList(entries: { rdns: Rdns }[]): string {
  if (entries.length === 0) {
    return info("No reverse DNS entries found.");
  }

  const table = createTable(["IP", "PTR Record"]);

  for (const { rdns } of entries) {
    table.push([rdns.ip, rdns.ptr]);
  }

  return table.toString();
}

export function formatSshKeyList(keys: { key: SshKey }[]): string {
  if (keys.length === 0) {
    return info("No SSH keys found.");
  }

  const table = createTable(["Name", "Fingerprint", "Type", "Size"]);

  for (const { key } of keys) {
    table.push([
      key.name,
      key.fingerprint,
      key.type.toUpperCase(),
      `${key.size} bits`,
    ]);
  }

  return table.toString();
}

export function formatSshKeyDetails(key: SshKey): string {
  const lines: string[] = [];

  lines.push(heading(`SSH Key: ${key.name}`));
  lines.push("");

  const table = createTable(["Property", "Value"]);
  table.push(
    ["Name", key.name],
    ["Fingerprint", key.fingerprint],
    ["Type", key.type.toUpperCase()],
    ["Size", `${key.size} bits`]
  );

  lines.push(table.toString());
  lines.push("");
  lines.push(colorize("Public Key:", "bold"));
  lines.push(key.data);

  return lines.join("\n");
}

export function formatFirewall(firewall: Firewall): string {
  const lines: string[] = [];

  lines.push(heading(`Firewall for Server ${firewall.server_number}`));
  lines.push("");

  const statusTable = createTable(["Property", "Value"]);
  statusTable.push(
    ["Server IP", firewall.server_ip],
    ["Status", formatStatus(firewall.status)],
    ["IPv6 Filtering", firewall.filter_ipv6 ? "Enabled" : "Disabled"],
    ["Whitelist HOS", firewall.whitelist_hos ? "Enabled" : "Disabled"],
    ["Port", firewall.port]
  );

  lines.push(statusTable.toString());

  // Input rules
  if (firewall.rules.input && firewall.rules.input.length > 0) {
    lines.push("");
    lines.push(colorize("Input Rules:", "bold"));
    const inputTable = createTable([
      "Name",
      "Action",
      "Protocol",
      "Src IP",
      "Dst Port",
    ]);
    for (const rule of firewall.rules.input) {
      inputTable.push([
        rule.name || "-",
        rule.action === "accept"
          ? colorize(rule.action, "green")
          : colorize(rule.action, "red"),
        rule.protocol || "any",
        rule.src_ip || "any",
        rule.dst_port || "any",
      ]);
    }
    lines.push(inputTable.toString());
  }

  return lines.join("\n");
}

export function formatFirewallTemplateList(
  templates: { firewall_template: FirewallTemplate }[]
): string {
  if (templates.length === 0) {
    return info("No firewall templates found.");
  }

  const table = createTable(["ID", "Name", "Default", "IPv6", "Rules"]);

  for (const { firewall_template: tmpl } of templates) {
    table.push([
      tmpl.id.toString(),
      tmpl.name,
      tmpl.is_default ? colorize("Yes", "green") : "No",
      tmpl.filter_ipv6 ? "Yes" : "No",
      tmpl.rules.input.length.toString(),
    ]);
  }

  return table.toString();
}

export function formatVSwitchList(vswitches: VSwitchSummary[]): string {
  if (vswitches.length === 0) {
    return info("No vSwitches found.");
  }

  const table = createTable(["ID", "Name", "VLAN", "Cancelled"]);

  for (const vswitch of vswitches) {
    table.push([
      vswitch.id.toString(),
      vswitch.name,
      vswitch.vlan.toString(),
      vswitch.cancelled ? colorize("Yes", "red") : "No",
    ]);
  }

  return table.toString();
}

export function formatVSwitchDetails(vswitch: VSwitch): string {
  const lines: string[] = [];

  lines.push(heading(`vSwitch ${vswitch.id}: ${vswitch.name}`));
  lines.push("");

  const table = createTable(["Property", "Value"]);
  table.push(
    ["ID", vswitch.id.toString()],
    ["Name", vswitch.name],
    ["VLAN", vswitch.vlan.toString()],
    ["Cancelled", vswitch.cancelled ? colorize("Yes", "red") : "No"]
  );

  lines.push(table.toString());

  // Servers
  if (vswitch.server.length > 0) {
    lines.push("");
    lines.push(colorize("Connected Servers:", "bold"));
    const serverTable = createTable(["Server IP", "Server #", "Status"]);
    for (const srv of vswitch.server) {
      serverTable.push([
        srv.server_ip,
        srv.server_number.toString(),
        formatStatus(srv.status),
      ]);
    }
    lines.push(serverTable.toString());
  }

  // Subnets
  if (vswitch.subnet.length > 0) {
    lines.push("");
    lines.push(colorize("Subnets:", "bold"));
    const subnetTable = createTable(["Subnet", "Gateway"]);
    for (const subnet of vswitch.subnet) {
      subnetTable.push([`${subnet.ip}/${subnet.mask}`, subnet.gateway]);
    }
    lines.push(subnetTable.toString());
  }

  return lines.join("\n");
}

export function formatStorageBoxList(
  boxes: { storagebox: StorageBox }[]
): string {
  if (boxes.length === 0) {
    return info("No storage boxes found.");
  }

  const table = createTable([
    "ID",
    "Name",
    "Product",
    "Location",
    "Usage",
    "Status",
  ]);

  for (const { storagebox } of boxes) {
    const usagePercent = Math.round(
      (storagebox.disk_usage / storagebox.disk_quota) * 100
    );
    const usageBar = `${formatBytes(storagebox.disk_usage)} / ${formatBytes(storagebox.disk_quota)} (${usagePercent}%)`;

    let status: string;
    if (storagebox.cancelled) {
      status = colorize("Cancelled", "red");
    } else if (storagebox.locked) {
      status = colorize("Locked", "yellow");
    } else {
      status = colorize("Active", "green");
    }

    table.push([
      storagebox.id.toString(),
      storagebox.name || storagebox.login,
      storagebox.product,
      storagebox.location,
      usageBar,
      status,
    ]);
  }

  return table.toString();
}

export function formatStorageBoxDetails(box: StorageBox): string {
  const lines: string[] = [];

  lines.push(heading(`Storage Box ${box.id}: ${box.name || box.login}`));
  lines.push("");

  const table = createTable(["Property", "Value"]);
  const usagePercent = Math.round((box.disk_usage / box.disk_quota) * 100);

  table.push(
    ["ID", box.id.toString()],
    ["Login", box.login],
    ["Name", box.name || "-"],
    ["Product", box.product],
    ["Location", box.location],
    ["Server", box.server],
    ["Host System", box.host_system],
    ["Paid Until", formatDate(box.paid_until)],
    ["Disk Quota", formatBytes(box.disk_quota)],
    ["Disk Usage", `${formatBytes(box.disk_usage)} (${usagePercent}%)`],
    ["Data Usage", formatBytes(box.disk_usage_data)],
    ["Snapshot Usage", formatBytes(box.disk_usage_snapshots)],
    ["Cancelled", box.cancelled ? colorize("Yes", "red") : "No"],
    ["Locked", box.locked ? colorize("Yes", "yellow") : "No"]
  );

  lines.push(table.toString());

  // Features
  lines.push("");
  lines.push(colorize("Features:", "bold"));
  const features = [
    { name: "WebDAV", enabled: box.webdav },
    { name: "Samba/CIFS", enabled: box.samba },
    { name: "SSH/SFTP", enabled: box.ssh },
    { name: "External Access", enabled: box.external_reachability },
    { name: "ZFS", enabled: box.zfs },
  ];

  for (const feature of features) {
    lines.push(
      `  ${feature.name}: ${feature.enabled ? colorize("Enabled", "green") : colorize("Disabled", "gray")}`
    );
  }

  return lines.join("\n");
}

export function formatStorageBoxSnapshots(
  snapshots: { snapshot: StorageBoxSnapshot }[]
): string {
  if (snapshots.length === 0) {
    return info("No snapshots found.");
  }

  const table = createTable(["Name", "Timestamp", "Size"]);

  for (const { snapshot } of snapshots) {
    table.push([
      snapshot.name,
      formatDateTime(snapshot.timestamp),
      snapshot.size_formatted || formatBytes(snapshot.size),
    ]);
  }

  return table.toString();
}

export function formatStorageBoxSubaccounts(
  subaccounts: { subaccount: StorageBoxSubaccount }[]
): string {
  if (subaccounts.length === 0) {
    return info("No subaccounts found.");
  }

  const table = createTable([
    "Username",
    "Home Directory",
    "SSH",
    "Samba",
    "WebDAV",
    "Read-only",
  ]);

  for (const { subaccount } of subaccounts) {
    table.push([
      subaccount.username,
      subaccount.homedirectory,
      subaccount.ssh ? "Yes" : "No",
      subaccount.samba ? "Yes" : "No",
      subaccount.webdav ? "Yes" : "No",
      subaccount.readonly ? colorize("Yes", "yellow") : "No",
    ]);
  }

  return table.toString();
}

export function formatTraffic(traffic: Traffic): string {
  const lines: string[] = [];

  lines.push(heading(`Traffic for ${traffic.ip}`));
  lines.push(`Period: ${formatDate(traffic.from)} - ${formatDate(traffic.to)}`);
  lines.push("");

  const table = createTable(["Date", "In", "Out", "Total"]);

  for (const data of traffic.data) {
    table.push([
      data.date || "-",
      formatBytes(data.in),
      formatBytes(data.out),
      formatBytes(data.sum),
    ]);
  }

  lines.push(table.toString());

  return lines.join("\n");
}

export function formatWolResult(wol: Wol): string {
  return success(
    `Wake-on-LAN packet sent to server ${wol.server_number} (${wol.server_ip})`
  );
}

export function formatServerProductList(
  products: { product: ServerProduct }[]
): string {
  if (products.length === 0) {
    return info("No products found.");
  }

  const table = createTable(["ID", "Name", "Traffic", "Locations"]);

  for (const { product } of products) {
    table.push([
      product.id,
      product.name,
      product.traffic,
      product.location.join(", "),
    ]);
  }

  return table.toString();
}

export function formatServerMarketProductList(
  products: { product: ServerMarketProduct }[]
): string {
  if (products.length === 0) {
    return info("No market products available.");
  }

  const table = createTable(["ID", "Name", "CPU", "RAM", "HDD", "DC", "Price"]);

  for (const { product } of products) {
    table.push([
      product.id.toString(),
      product.name,
      product.cpu,
      `${product.memory_size} GB`,
      product.hdd_text,
      product.datacenter,
      `€${product.price}/mo`,
    ]);
  }

  return table.toString();
}

export function formatTransactionList(
  transactions: { transaction: ServerTransaction }[]
): string {
  if (transactions.length === 0) {
    return info("No transactions found.");
  }

  const table = createTable(["ID", "Date", "Product", "Status", "Server"]);

  for (const { transaction } of transactions) {
    table.push([
      transaction.id,
      formatDate(transaction.date),
      transaction.product.name,
      formatStatus(transaction.status),
      transaction.server_ip || "-",
    ]);
  }

  return table.toString();
}

export function formatCancellation(cancellation: Cancellation): string {
  const lines: string[] = [];

  lines.push(heading(`Cancellation for Server ${cancellation.server_number}`));
  lines.push("");

  const table = createTable(["Property", "Value"]);
  table.push(
    ["Server Number", cancellation.server_number.toString()],
    ["Server IP", cancellation.server_ip],
    ["Server Name", cancellation.server_name || "-"],
    [
      "Earliest Cancellation",
      formatDate(cancellation.earliest_cancellation_date),
    ],
    ["Cancelled", cancellation.cancelled ? colorize("Yes", "red") : "No"]
  );

  if (cancellation.cancelled && cancellation.cancellation_date) {
    table.push([
      "Cancellation Date",
      formatDate(cancellation.cancellation_date),
    ]);
    if (cancellation.cancellation_reason) {
      table.push(["Reason", cancellation.cancellation_reason.join(", ")]);
    }
  }

  lines.push(table.toString());

  return lines.join("\n");
}
