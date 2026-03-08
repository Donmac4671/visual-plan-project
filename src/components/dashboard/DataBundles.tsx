import { useState } from "react";
import { Wifi, ChevronDown, ChevronUp, ShoppingCart } from "lucide-react";
import { networks, Network, DataBundle, formatCurrency } from "@/lib/data";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";

function NetworkIcon({ network }: { network: Network }) {
  const colors: Record<string, string> = {
    mtn: "bg-yellow-400 text-yellow-900",
    telecel: "bg-red-500 text-white",
    "at-bigtime": "bg-sky-600 text-white",
    "at-premium": "bg-sky-700 text-white",
  };
  const initials: Record<string, string> = {
    mtn: "MTN",
    telecel: "T",
    "at-bigtime": "AT",
    "at-premium": "AT",
  };
  return (
    <div className={`w-10 h-10 rounded-full ${colors[network.id] || "bg-muted"} flex items-center justify-center`}>
      <span className="text-xs font-bold">{initials[network.id]}</span>
    </div>
  );
}

function BundleCard({ bundle, network, onSelect }: { bundle: DataBundle; network: Network; onSelect: () => void }) {
  const gradientClass = network.gradient;

  return (
    <div className="flex flex-col items-center">
      <div className={`${gradientClass} rounded-2xl p-4 w-full aspect-square flex flex-col items-center justify-center text-white relative`}>
        <span className="text-3xl lg:text-4xl font-bold">{bundle.sizeGB}</span>
        <span className="text-xs font-medium uppercase">Gigabytes</span>
      </div>
      <div className="mt-2 bg-accent rounded-full px-3 py-1 flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground">Price</span>
        <span className="text-sm font-bold text-foreground">{formatCurrency(bundle.price)}</span>
      </div>
      <Button
        size="sm"
        className="mt-2 gradient-primary border-0 text-xs w-full"
        onClick={onSelect}
      >
        <ShoppingCart className="w-3 h-3 mr-1" /> Select Bundle
      </Button>
    </div>
  );
}

export default function DataBundles() {
  const [expandedNetwork, setExpandedNetwork] = useState<string | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<{ network: Network; bundle: DataBundle } | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const { addItem } = useCart();
  const { toast } = useToast();

  const toggleNetwork = (id: string) => {
    setExpandedNetwork(expandedNetwork === id ? null : id);
  };

  const handleAddToCart = () => {
    if (!selectedBundle || phoneNumber.length !== 10 || !/^\d{10}$/.test(phoneNumber)) {
      toast({ title: "Error", description: "Please enter a valid 10-digit phone number", variant: "destructive" });
      return;
    }
    addItem(selectedBundle.network.id, selectedBundle.network.name, selectedBundle.bundle, phoneNumber);
    toast({ title: "Added to cart", description: `${selectedBundle.network.name} ${selectedBundle.bundle.size} added` });
    setSelectedBundle(null);
    setPhoneNumber("");
  };

  return (
    <>
      <div className="gradient-primary rounded-2xl p-4 lg:p-5 mb-4">
        <div className="flex items-center gap-3">
          <Wifi className="w-6 h-6 text-primary-foreground" />
          <div>
            <h2 className="text-lg font-bold text-primary-foreground">Data Bundles</h2>
            <p className="text-sm text-primary-foreground/70">Select your network and choose a data package</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {networks.map((network) => (
          <div key={network.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <button
              onClick={() => toggleNetwork(network.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <NetworkIcon network={network} />
                <div className="text-left">
                  <p className="font-semibold text-foreground">{network.name}</p>
                  <p className="text-xs text-muted-foreground">{network.bundles.length} data packages available</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded-full">
                  {network.bundles.length} bundles
                </span>
                {expandedNetwork === network.id ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {expandedNetwork === network.id && (
              <div className="p-4 pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {network.bundles.map((bundle) => (
                    <BundleCard
                      key={bundle.size}
                      bundle={bundle}
                      network={network}
                      onSelect={() => setSelectedBundle({ network, bundle })}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add to cart dialog */}
      <Dialog open={!!selectedBundle} onOpenChange={() => setSelectedBundle(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {selectedBundle && <NetworkIcon network={selectedBundle.network} />}
              <div>
                <DialogTitle>{selectedBundle?.network.name} {selectedBundle?.bundle.size}</DialogTitle>
                <p className="text-sm text-muted-foreground">Add bundle to cart</p>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-accent rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">💰 Price</p>
              <p className="text-xl font-bold text-foreground">{selectedBundle && formatCurrency(selectedBundle.bundle.price)}</p>
            </div>
            <div className="bg-accent rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">⏱ Validity</p>
              <p className="text-xl font-bold text-foreground">90 Days</p>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-sm font-medium text-foreground flex items-center gap-1 mb-2">
              📞 Recipient Phone Number
            </label>
            <Input
              placeholder="e.g., 0549358359"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>

          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setSelectedBundle(null)}>
              Cancel
            </Button>
            <Button className="flex-1 gradient-primary border-0" onClick={handleAddToCart}>
              <ShoppingCart className="w-4 h-4 mr-1" /> Add to Cart
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
