import type { Command } from "commander";
import { registerCertificateCommands } from "./certificate.js";
import { registerContextCommands } from "./context.js";
import { registerDatacenterCommands } from "./datacenter.js";
import { registerCloudFirewallCommands } from "./firewall.js";
import { registerFloatingIpCommands } from "./floating-ip.js";
import { registerImageCommands } from "./image.js";
import { registerInventoryCommands } from "./inventory.js";
import { registerIsoCommands } from "./iso.js";
import { registerLoadBalancerCommands } from "./load-balancer.js";
import { registerLoadBalancerTypeCommands } from "./load-balancer-type.js";
import { registerLocationCommands } from "./location.js";
import { registerNetworkCommands } from "./network.js";
import { registerPlacementGroupCommands } from "./placement-group.js";
import { registerPricingCommands } from "./pricing.js";
import { registerPrimaryIpCommands } from "./primary-ip.js";
import { registerCloudServerCommands } from "./server.js";
import { registerServerTypeCommands } from "./server-type.js";
import { registerCloudSshKeyCommands } from "./ssh-key.js";
import { registerVolumeCommands } from "./volume.js";

export function registerCloudCommands(parent: Command): void {
  const cloud = parent
    .command("cloud")
    .description("Hetzner Cloud API management");

  cloud.option("--token <token>", "Cloud API token (overrides context)");

  registerContextCommands(cloud);

  // Read-only resources
  registerDatacenterCommands(cloud);
  registerLocationCommands(cloud);
  registerServerTypeCommands(cloud);
  registerLoadBalancerTypeCommands(cloud);
  registerIsoCommands(cloud);
  registerPricingCommands(cloud);
  registerInventoryCommands(cloud);

  // Core resources
  registerCloudServerCommands(cloud);
  registerNetworkCommands(cloud);
  registerCloudFirewallCommands(cloud);
  registerFloatingIpCommands(cloud);
  registerPrimaryIpCommands(cloud);
  registerVolumeCommands(cloud);
  registerLoadBalancerCommands(cloud);
  registerImageCommands(cloud);

  // Ancillary resources
  registerCloudSshKeyCommands(cloud);
  registerCertificateCommands(cloud);
  registerPlacementGroupCommands(cloud);
}
