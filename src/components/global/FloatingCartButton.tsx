import { ShoppingCart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useNavigate, useLocation } from "react-router-dom";
import { formatCurrency } from "@/lib/data";
import { useAuth } from "@/contexts/AuthContext";

export default function FloatingCartButton() {
  const { itemCount, total } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show on cart page or when not logged in
  if (location.pathname === "/cart" || !user) return null;

  return (
    <button
      onClick={() => navigate("/cart")}
      className="fixed bottom-24 right-4 z-50 flex items-center gap-2 gradient-primary text-primary-foreground px-4 py-3 rounded-full shadow-lg hover:scale-105 transition-transform"
    >
      <div className="relative">
        <ShoppingCart className="w-5 h-5" />
        {itemCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {itemCount}
          </span>
        )}
      </div>
      {itemCount > 0 && <span className="font-semibold">{formatCurrency(total)}</span>}
    </button>
  );
}
