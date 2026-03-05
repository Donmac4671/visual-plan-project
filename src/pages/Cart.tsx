import DashboardLayout from "@/components/layout/DashboardLayout";
import { useCart } from "@/contexts/CartContext";
import { formatCurrency } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Trash2, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Cart() {
  const { items, removeItem, clearCart, total } = useCart();
  const { toast } = useToast();

  const handleCheckout = () => {
    toast({ title: "Order Placed!", description: `${items.length} bundles ordered for ${formatCurrency(total)}` });
    clearCart();
  };

  return (
    <DashboardLayout title="Cart">
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Shopping Cart ({items.length})
          </h2>
          {items.length > 0 && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={clearCart}>
              Clear All
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Your cart is empty</p>
            <p className="text-sm">Select data bundles from the dashboard to add them here</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center">
                      <span className="text-xs font-bold">{item.network.slice(0, 3)}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{item.network} — {item.bundle.size}</p>
                      <p className="text-sm text-muted-foreground">📞 {item.phoneNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-foreground">{formatCurrency(item.bundle.price)}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-foreground">Total</span>
                <span className="text-xl font-bold text-foreground">{formatCurrency(total)}</span>
              </div>
              <Button className="w-full gradient-primary border-0" size="lg" onClick={handleCheckout}>
                Place Order — {formatCurrency(total)}
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
