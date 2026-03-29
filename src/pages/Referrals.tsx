import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/data";
import { Copy, Users, Gift, Share2, CheckCircle, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function Referrals() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchReferrals = async () => {
      const { data } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });
      setReferrals(data || []);
      setLoading(false);
    };
    fetchReferrals();
  }, [user]);

  const referralCode = profile?.referral_code || "";
  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;

  const totalEarned = referrals
    .filter((r) => r.reward_paid)
    .reduce((sum, r) => sum + Number(r.reward_amount), 0);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
  };

  return (
    <DashboardLayout title="Referrals">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <Users className="w-6 h-6 mx-auto mb-2 text-primary" />
          <p className="text-2xl font-bold text-foreground">{referrals.length}</p>
          <p className="text-xs text-muted-foreground">Total Referrals</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <CheckCircle className="w-6 h-6 mx-auto mb-2 text-success" />
          <p className="text-2xl font-bold text-foreground">{referrals.filter((r) => r.reward_paid).length}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <Gift className="w-6 h-6 mx-auto mb-2 text-warning" />
          <p className="text-2xl font-bold text-foreground">{formatCurrency(totalEarned)}</p>
          <p className="text-xs text-muted-foreground">Total Earned</p>
        </div>
      </div>

      {/* Referral Code Card */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
          <Share2 className="w-5 h-5 text-primary" /> Your Referral Code
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Share your code with friends. Earn <span className="font-bold text-primary">₵0.50</span> for each user referral and <span className="font-bold text-primary">₵10.00</span> for each agent referral when they make their first purchase.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 bg-muted rounded-lg px-4 py-3 font-mono text-lg font-bold text-foreground tracking-wider text-center">
            {referralCode || "Loading..."}
          </div>
          <Button size="sm" variant="outline" onClick={() => copyToClipboard(referralCode, "Referral code")}>
            <Copy className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground truncate">
            {referralLink}
          </div>
          <Button size="sm" variant="outline" onClick={() => copyToClipboard(referralLink, "Referral link")}>
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Referral History */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Referral History</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reward</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {referrals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  {loading ? "Loading..." : "No referrals yet. Share your code to start earning!"}
                </TableCell>
              </TableRow>
            ) : (
              referrals.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{format(parseISO(r.created_at), "MMM dd, yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={r.reward_paid ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"}>
                      {r.reward_paid ? "Paid" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {r.reward_paid ? formatCurrency(Number(r.reward_amount)) : (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" /> Awaiting purchase
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </DashboardLayout>
  );
}
