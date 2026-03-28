import DashboardLayout from "@/components/layout/DashboardLayout";
import StatsCards from "@/components/dashboard/StatsCards";
import WalletTopUp from "@/components/dashboard/WalletTopUp";
import ClaimPayment from "@/components/dashboard/ClaimPayment";
import DataBundles from "@/components/dashboard/DataBundles";
import { useCanonical } from "@/hooks/useCanonical";

export default function Index() {
  useCanonical("/");
  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        <StatsCards />
        <WalletTopUp />
        <ClaimPayment />
        <DataBundles />
        <p className="text-center text-xs text-muted-foreground pb-4">© 2026 Donmac Data Hub. All rights reserved.</p>
      </div>
    </DashboardLayout>
  );
}
