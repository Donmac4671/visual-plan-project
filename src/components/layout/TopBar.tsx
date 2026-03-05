import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShoppingCart, User, Wallet, Menu, X, LayoutDashboard, ShoppingBag, Receipt, CreditCard, LogOut } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { formatCurrency } from "@/lib/data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Orders", icon: ShoppingBag, path: "/orders" },
  { label: "Transactions", icon: Receipt, path: "/transactions" },
  { label: "Top Ups", icon: CreditCard, path: "/topups" },
];

export default function TopBar({ title }: { title: string }) {
  const { itemCount } = useCart();
  const location = useLocation();
  const walletBalance = 94.10;

  return (
    <header className="flex items-center justify-between px-4 lg:px-6 py-3 bg-card border-b border-border">
      <div className="flex items-center gap-3">
        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger className="lg:hidden">
            <Menu className="w-5 h-5 text-muted-foreground" />
          </SheetTrigger>
          <SheetContent side="left" className="w-[260px] p-4">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">D</span>
              </div>
              <span className="font-bold text-foreground">Donmac Data Hub</span>
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "gradient-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent mt-4">
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <LayoutDashboard className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">{title}</h1>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Cart */}
        <Link to="/cart" className="relative p-2 rounded-lg hover:bg-accent transition-colors">
          <ShoppingCart className="w-5 h-5 text-muted-foreground" />
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 gradient-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
              {itemCount}
            </span>
          )}
        </Link>

        {/* Balance */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-accent rounded-lg">
          <Wallet className="w-4 h-4 text-primary" />
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Balance</p>
            <p className="text-sm font-bold text-foreground">{formatCurrency(walletBalance)}</p>
          </div>
        </div>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger className="p-2 rounded-lg hover:bg-accent transition-colors">
            <User className="w-5 h-5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold">U</span>
              </div>
              <div>
                <p className="font-semibold text-sm">User</p>
                <p className="text-xs text-muted-foreground">user@example.com</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/orders" className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" /> Orders
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/transactions" className="flex items-center gap-2">
                <Receipt className="w-4 h-4" /> Transactions
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
