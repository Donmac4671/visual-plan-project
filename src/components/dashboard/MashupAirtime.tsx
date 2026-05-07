import { useState } from "react";
import { Phone, Smartphone, ShoppingCart, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import {
  MASHUP_PACKAGES,
  MashupPackage,
  AIRTIME_MIN,
  AIRTIME_MAX,
  formatCurrency,
  calculateMashupFee,
} from "@/lib/data";

type Mode = null | "mashup" | "airtime";

// ============================================================
// Phone number validation
// ============================================================
// MTN prefixes: 024, 054, 055, 059, 020, 050
const MTN_PREFIXES = ["024", "054", "055", "059", "020", "050"];
const ALL_NETWORK_PREFIXES = ["024", "054", "055", "059", "020", "050", "020", "026", "056", "057", "027", "028"];

function isMTNNumber(phone: string): boolean {
  // Check if phone number starts with any MTN prefix
  return MTN_PREFIXES.some(prefix => phone.startsWith(prefix));
}

function isValidGhanaNumber(phone: string): boolean {
  // Check if phone number starts with any valid Ghana prefix
  return ALL_NETWORK_PREFIXES.some(prefix => phone.startsWith(prefix));
}

export default function MashupAirtime() {
  const [expanded, setExpanded] = useState<Mode>(null);
  const [pkg, setPkg] = useState<MashupPackage | null>(null);
  const [airtimeOpen, setAirtimeOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [airtimeAmount, setAirtimeAmount] = useState("");
  const { addItem } = useCart();
  const { toast } = useToast();

  const validPhone = /^\d{10}$/.test(phone);
  const isMTN = isMTNNumber(phone);
  const isValidNetwork = isValidGhanaNumber(phone);

  const closeMashup = () => { setPkg(null); setPhone(""); };
  const closeAirtime = () => { setAirtimeOpen(false); setPhone(""); setAirtimeAmount(""); };

  const handleAddMashup = () => {
    if (!pkg) return;
    
    // Validate phone number exists
    if (!validPhone) {
      toast({ 
        title: "Invalid phone number", 
        description: "Please enter a valid 10-digit phone number", 
        variant: "destructive" 
      });
      return;
    }
    
    // 🔥 Mashup ONLY works with MTN numbers
    if (!isMTN) {
      toast({ 
        title: "MTN Only", 
        description: "MashUp packages are only available for MTN numbers. Please use an MTN number starting with 024, 054, 055, 059, 020, or 050.", 
        variant: "destructive" 
      });
      return;
    }
    
    addItem(
      "mashup",
      "MashUp",
      {
        size: `MashUp ${formatCurrency(pkg.price)} (${pkg.data} / ${pkg.minutes})`,
        sizeGB: 0,
        price: pkg.price,
        generalPrice: pkg.price,
      },
      phone,
      pkg.price,
    );
    toast({ 
      title: "Added to cart", 
      description: `MashUp ${formatCurrency(pkg.price)} for MTN ${phone}` 
    });
    closeMashup();
  };

  const handleAddAirtime = () => {
    const amt = parseFloat(airtimeAmount);
    
    // Validate phone number exists
    if (!validPhone) {
      toast({ 
        title: "Invalid phone number", 
        description: "Please enter a valid 10-digit phone number", 
        variant: "destructive" 
      });
      return;
    }
    
    // ✅ Airtime works with ANY Gh