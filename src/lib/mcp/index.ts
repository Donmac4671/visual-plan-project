import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getWalletBalance from "./tools/get-wallet-balance";
import listRecentOrders from "./tools/list-recent-orders";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "donmac-data-hub-mcp",
  title: "Donmac Data Hub",
  version: "0.1.0",
  instructions:
    "Tools for the signed-in Donmac Data Hub user. Use `get_wallet_balance` to check the user's GHS wallet balance, and `list_recent_orders` to see their recent data-bundle orders.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getWalletBalance, listRecentOrders],
});
