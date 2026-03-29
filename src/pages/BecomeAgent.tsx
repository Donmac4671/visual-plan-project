import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Copy, CheckCircle, Smartphone, Crown, Clock, XCircle } from "lucide-react";

export default function BecomeAgent() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [reason, setReason] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [existingApplication, setExistingApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const REGISTRATION_FEE = 40;
  const MOMO_NUMBER = "0549358359";
  const MOMO_NAME = "Osei Michael";

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setEmail(profile.email || "");
      setPhone(profile.phone || "");
    }
  }, [profile]);

  useEffect(() => {
    const fetchApplication = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("agent_applications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setExistingApplication(data);
      setLoading(false);
    };
    fetchApplication();
  }, [user]);

  const handleCopy = () => {
    navigator.clipboard.writeText(MOMO_NUMBER);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (!transactionId.trim()) {
      toast({ title: "Error", description: "Please enter your transaction ID", variant: "destructive" });
      return;
    }

    setUploading(true);

    const { error } = await supabase.from("agent_applications").insert({
      user_id: user.id,
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      location: location.trim(),
      reason: reason.trim(),
      screenshot_url: transactionId.trim(),
    });

    if (error) {
      toast({ title: "Submission Failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    toast({ title: "Application Submitted!", description: "We'll review your application and get back to you shortly." });
    setUploading(false);
    setTransactionId("");

    // Refresh application status
    const { data } = await supabase
      .from("agent_applications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setExistingApplication(data);
  };

  if (loading) {
    return (
      <DashboardLayout title="Become an Agent">
        <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
      </DashboardLayout>
    );
  }

  // Already an agent
  if (profile?.tier === "agent") {
    return (
      <DashboardLayout title="Become an Agent">
        <div className="max-w-lg mx-auto text-center py-16">
          <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">You're Already an Agent!</h2>
          <p className="text-muted-foreground">You're enjoying agent-tier pricing on all data bundles.</p>
        </div>
      </DashboardLayout>
    );
  }

  // Has pending/approved application
  if (existingApplication) {
    const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
      pending: { icon: Clock, color: "text-yellow-500", label: "Pending Review" },
      approved: { icon: CheckCircle, color: "text-success", label: "Approved" },
      rejected: { icon: XCircle, color: "text-destructive", label: "Rejected" },
    };
    const config = statusConfig[existingApplication.status] || statusConfig.pending;
    const StatusIcon = config.icon;

    return (
      <DashboardLayout title="Become an Agent">
        <div className="max-w-lg mx-auto text-center py-16">
          <StatusIcon className={`w-16 h-16 mx-auto mb-4 ${config.color}`} />
          <h2 className="text-xl font-bold text-foreground mb-2">Application {config.label}</h2>
          <p className="text-muted-foreground mb-4">
            {existingApplication.status === "pending" && "Your application is being reviewed. We'll notify you once it's processed."}
            {existingApplication.status === "approved" && "Congratulations! Your agent status will be activated shortly."}
            {existingApplication.status === "rejected" && (existingApplication.admin_notes || "Your application was not approved. Please contact support for more info.")}
          </p>
          <Badge variant="outline" className="text-sm">{config.label}</Badge>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Become an Agent">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Info Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Crown className="w-6 h-6 text-primary mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">Agent Benefits</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Discounted prices on all data bundles</li>
                  <li>• Unique agent code for tracking</li>
                  <li>• Priority support</li>
                </ul>
                <p className="text-sm font-semibold text-primary mt-2">Registration Fee: ₵{REGISTRATION_FEE}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Application Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Application Form</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Full Name *</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Email *</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Phone Number *</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Your phone number" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Location</label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Your city/town" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Why do you want to become an agent?</label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tell us briefly..." rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Payment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="w-5 h-5" /> Payment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send <span className="font-bold text-foreground">₵{REGISTRATION_FEE}</span> via MTN Mobile Money to:
            </p>
            <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">MoMo Number</p>
                  <p className="text-lg font-bold text-foreground">{MOMO_NUMBER}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                  {copied ? <CheckCircle className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Account Name</p>
                <p className="font-semibold text-foreground">{MOMO_NAME}</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Upload Proof of Payment *</label>
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  id="payment-proof"
                  className="hidden"
                  onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)}
                />
                <label htmlFor="payment-proof" className="cursor-pointer">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {screenshotFile ? screenshotFile.name : "Tap to upload screenshot"}
                  </p>
                </label>
              </div>
            </div>

            <Button
              className="w-full gradient-primary text-primary-foreground"
              onClick={handleSubmit}
              disabled={uploading}
            >
              {uploading ? "Submitting..." : "Submit Application"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
