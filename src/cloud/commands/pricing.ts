import type { Command } from "commander";
import { output } from "../../shared/helpers.js";
import { formatPricingSummary } from "../formatter.js";
import { type CloudActionOptions, cloudAction } from "../helpers.js";

export function registerPricingCommands(parent: Command): void {
  const pricing = parent
    .command("pricing")
    .description(
      "List prices from GET /pricing (list prices, not per-account billing)"
    );

  pricing
    .command("show", { isDefault: true })
    .description(
      "Show current list prices (server types, load balancers, IPs, storage)"
    )
    .action(
      cloudAction(async (client, options: CloudActionOptions) => {
        const data = await client.getPricing();
        output(data, formatPricingSummary, options);
      })
    );
}
