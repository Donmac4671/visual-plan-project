import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, ShoppingBag, Receipt, CreditCard, LogOut, User, Shield, MessageSquare, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Orders", icon: ShoppingBag, path: "/orders" },
  { label: "Transactions", icon: Receipt, path: "/transactions" },
  { label: "Top Ups", icon: CreditCard, path: "/topups" },
  { label: "Complaints", icon: MessageSquare, path: "/complaints" },
  { label: "Profile", icon: User, path: "/profile" },
  { label: "Become an Agent", icon: Crown, path: "/become-agent", hideForAgents: true },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isAdmin, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="hidden lg:flex flex-col w-[220px] min-h-screen bg-card border-r border-border p-4">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-lg">D</span>
        </div>
        <span className="font-bold text-foreground text-sm">Donmac Data Hub</span>
      </div>

      <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">
              {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{profile?.full_name || "User"}</p>
            <p className="text-xs text-muted-foreground">{profile?.agent_code || "Agent"}</p>
          </div>
        </div>
      </div>

      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Navigation</p>
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive ? "gradient-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            to="/admin"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              location.pathname === "/admin" ? "gradient-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Shield className="w-4 h-4" />
            Admin
          </Link>
        )}
      </nav>

      <button
        type="button"
        onClick={() => {
          void handleSignOut();
        }}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all mt-4"
      >
        <LogOut className="w-4 h-4" />
        Logout
      </button>
    </aside>
  );
}

