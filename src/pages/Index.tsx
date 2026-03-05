import DashboardLayout from "@/components/layout/DashboardLayout";
import StatsCards from "@/components/dashboard/StatsCards";
import WalletTopUp from "@/components/dashboard/WalletTopUp";
import DataBundles from "@/components/dashboard/DataBundles";

export default function Index() {
  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        <StatsCards />
        <WalletTopUp />
        <DataBundles />
      </div>
    </DashboardLayout>
  );
}
