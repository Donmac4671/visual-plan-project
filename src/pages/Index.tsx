import DashboardLayout from "@/components/layout/DashboardLayout";
import StatsCards from "@/components/dashboard/StatsCards";
import WalletTopUp from "@/components/dashboard/WalletTopUp";
import ClaimPayment from "@/components/dashboard/ClaimPayment";
import DataBundles from "@/components/dashboard/DataBundles";
import PromoCountdown from "@/components/dashboard/PromoCountdown";
import WelcomeBanner from "@/components/dashboard/WelcomeBanner";
import HowToGuides from "@/components/dashboard/HowToGuides";
import { useCanonical } from "@/hooks/useCanonical";

export default function Index() {
  useCanonical("/");
  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        <WelcomeBanner />
        <PromoCountdown />
        <StatsCards />
        <WalletTopUp />
        <ClaimPayment />
        <DataBundles />
        <HowToGuides />
      </div>
    </DashboardLayout>
  );
}
