import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import Footer from "./Footer";
import { useLocation } from "react-router-dom";

export default function DashboardLayout({ children, title }: { children: ReactNode; title: string }) {
  const location = useLocation();
  const isDashboard = location.pathname === "/";
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <TopBar title={title} />
        <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
        <Footer showGuides={isDashboard} />
      </div>
    </div>
  );
}
