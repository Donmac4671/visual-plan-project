import DashboardLayout from "@/components/layout/DashboardLayout";
import StatsCards from "@/components/dashboard/StatsCards";
import WalletTopUp from "@/components/dashboard/WalletTopUp";
import ClaimPayment from "@/components/dashboard/ClaimPayment";
import DataBundles from "@/components/dashboard/DataBundles";
import MashupAirtime from "@/components/dashboard/MashupAirtime";
import MtnMashupPackages from "@/components/dashboard/MtnMashupPackages";
import PromoCountdown from "@/components/dashboard/PromoCountdown";
import WelcomeBanner from "@/components/dashboard/WelcomeBanner";
import SiteMessageBanner from "@/components/global/SiteMessageBanner";
import ErrorBoundary from "@/components/ErrorBoundary";

import { useCanonical } from "@/hooks/useCanonical";

export default function Index() {
  useCanonical("/dashboard");
  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        <ErrorBoundary label="WelcomeBanner"><WelcomeBanner /></ErrorBoundary>
        <ErrorBoundary label="SiteMessageBanner"><SiteMessageBanner /></ErrorBoundary>
        <ErrorBoundary label="PromoCountdown"><PromoCountdown /></ErrorBoundary>
        <ErrorBoundary label="StatsCards"><StatsCards /></ErrorBoundary>
        <ErrorBoundary label="WalletTopUp"><WalletTopUp /></ErrorBoundary>
        <ErrorBoundary label="ClaimPayment"><ClaimPayment /></ErrorBoundary>
        <ErrorBoundary label="MtnMashupPackages"><MtnMashupPackages /></ErrorBoundary>
        <ErrorBoundary label="DataBundles"><DataBundles /></ErrorBoundary>
        <ErrorBoundary label="MashupAirtime"><MashupAirtime /></ErrorBoundary>
      </div>
    </DashboardLayout>
  );
}
