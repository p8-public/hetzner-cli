// Re-export shared formatter utilities

// Auction formatters
export {
  formatAuctionDetails,
  formatAuctionList,
} from "./auction/formatter.js";

// Re-export robot-specific formatters for backward compatibility
export {
  formatBootConfig,
  formatCancellation,
  formatFailoverList,
  formatFailoverSwitch,
  formatFirewall,
  formatFirewallTemplateList,
  formatIpDetails,
  formatIpList,
  formatLinuxActivation,
  formatRdnsList,
  formatRescueActivation,
  formatResetOptions,
  formatResetResult,
  formatServerDetails,
  formatServerList,
  formatServerMarketProductList,
  formatServerProductList,
  formatSshKeyDetails,
  formatSshKeyList,
  formatStorageBoxDetails,
  formatStorageBoxList,
  formatStorageBoxSnapshots,
  formatStorageBoxSubaccounts,
  formatSubnetList,
  formatTraffic,
  formatTransactionList,
  formatVSwitchDetails,
  formatVSwitchList,
  formatVSwitchServers,
  formatWolResult,
} from "./robot/formatter.js";
export {
  colorize,
  colors,
  createTable,
  error,
  formatBytes,
  formatDate,
  formatDateTime,
  formatJson,
  formatStatus,
  heading,
  info,
  success,
  warning,
} from "./shared/formatter.js";
