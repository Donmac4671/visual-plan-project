import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Mail, Lock, User, Phone, Tag } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCanonical } from "@/hooks/useCanonical";
import { supabase } from "@/integrations/supabase/client";

export default function Register() {
  useCanonical("/register");
  const [searchParams] = useSearchParams();
  const refFromUrl = searchParams.get("ref") || "";
  const [referralCode, setReferralCode] = useState(refFromUrl);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedReferralCode = referralCode.trim().toUpperCase();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPhone || !password || !confirmPassword) {
      toast({ title: "Missing Information", description: "All fields are required.", variant: "destructive" });
      return;
    }
    if (!/^\d{10}$/.test(trimmedPhone)) {
      toast({ title: "Invalid Phone", description: "Phone number must be exactly 10 digits with no spaces.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    setLoading(true);

    // Pre-check: phone number must be unique
    const { data: existingPhone } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", trimmedPhone)
      .maybeSingle();
    if (existingPhone) {
      setLoading(false);
      toast({
        title: "Phone Already Registered",
        description: "This phone number is already linked to another account. Please use a different number.",
        variant: "destructive",
      });
      return;
    }

    const { error, data } = await signUp(email, password, name, phone, normalizedReferralCode || undefined);
    setLoading(false);
    if (error) {
      const msg = /phone/i.test(error.message) || /unique/i.test(error.message)
        ? "This phone number is already registered to another account."
        : error.message;
      toast({ title: "Registration Failed", description: msg, variant: "destructive" });
    } else {
      // Store referral code for processing after first login (user isn't authenticated yet)
      if (normalizedReferralCode) {
        localStorage.setItem("pending_referral_code", normalizedReferralCode);
      }
      toast({ title: "Account Created!", description: "You can now sign in." });
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-bold text-2xl">D</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Donmac Data Hub</h1>
          <p className="text-muted-foreground mt-1">Create your account</p>
        </div>
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} className="pl-10" required />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder="0549358359"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  maxLength={10}
                  pattern="\d{10}"
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type={showPassword ? "text" : "password"} placeholder="Create password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10" required />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Referral Code (optional)</label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="e.g., DMH1081ED" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} className="pl-10" />
              </div>
            </div>
            <Button type="submit" className="w-full gradient-primary border-0" size="lg" disabled={loading}>
              {loading ? "Creating Account..." : "Create Account"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-3">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">Sign In</Link>
          </p>
        </div>
        <div className="mt-4 rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground mb-2">Having trouble signing up? Contact us on WhatsApp.</p>
          <a
            href="https://wa.me/233549358359"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity shadow-sm"
            style={{ backgroundColor: "#25D366" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Contact Support
          </a>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">© 2026 Donmac Data Hub. All rights reserved.</p>
      </div>
    </div>
  );
}
