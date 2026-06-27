import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

export default function TermsAcceptanceGate() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const open = !!user && !!profile && !profile.terms_accepted_at;

  useEffect(() => {
    if (!open) setAgreed(false);
  }, [open]);

  const handleAccept = async () => {
    if (!agreed) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("accept_terms");
    setSubmitting(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    await refreshProfile();
    toast({ title: "Thank you!", description: "Terms accepted." });
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Accept our Terms & Privacy Policy</DialogTitle>
          <DialogDescription>
            Before you continue using Donmac Data Hub, please review and accept our updated policies.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-2">
          <p>
            Please read the{" "}
            <Link to="/terms" target="_blank" className="text-primary underline font-medium">Terms & Conditions</Link>{" "}
            and{" "}
            <Link to="/privacy" target="_blank" className="text-primary underline font-medium">Privacy Policy</Link>.
          </p>
          <p className="text-xs text-muted-foreground">
            Links open in a new tab so you don't lose your place here.
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} className="mt-0.5" />
          <span>I have read and agree to the Terms & Conditions and the Privacy Policy.</span>
        </label>

        <Button
          onClick={handleAccept}
          disabled={!agreed || submitting}
          className="w-full gradient-primary border-0"
          size="lg"
        >
          {submitting ? "Saving..." : "I Accept & Continue"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
