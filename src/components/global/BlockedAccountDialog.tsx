import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldAlert, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const WHATSAPP_SUPPORT = "https://wa.me/233549358359";

export default function BlockedAccountDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("donmac:account-blocked", handler);
    return () => window.removeEventListener("donmac:account-blocked", handler);
  }, []);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
            <ShieldAlert className="w-7 h-7 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Your account has been blocked
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-2">
            <span className="block">
              For your security and the integrity of Donmac Data Hub, an administrator has
              suspended access to this account.
            </span>
            <span className="block text-foreground font-medium">
              If you believe this is a mistake, please contact support to resolve it.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            asChild
            className="w-full bg-[#25D366] hover:bg-[#1ebe5b] text-white"
          >
            <a href={WHATSAPP_SUPPORT} target="_blank" rel="noreferrer">
              <MessageCircle className="w-4 h-4 mr-2" />
              Message Support on WhatsApp
            </a>
          </Button>
        </div>
        <AlertDialogFooter>
          <AlertDialogAction
            className="w-full"
            onClick={() => {
              setOpen(false);
              if (typeof window !== "undefined") window.location.href = "/login";
            }}
          >
            OK, take me to sign in
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
