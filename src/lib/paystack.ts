const PAYSTACK_PUBLIC_KEY = "pk_live_6c14e62b602fe818a0433130f1db628a98731304";

interface PaystackConfig {
  email: string;
  amount: number; // in GHS - will be converted to pesewas
  currency?: string;
  ref?: string;
  onSuccess: (reference: string) => void;
  onClose: () => void;
}

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).PaystackPop) {
      resolve();
      return;
    }
    // Remove any existing broken script
    const existing = document.querySelector('script[src*="paystack"]');
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v2/inline.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Paystack script"));
    document.head.appendChild(script);
  });
}

export async function initPaystack({ email, amount, currency = "GHS", ref, onSuccess, onClose }: PaystackConfig) {
  try {
    await loadPaystackScript();
  } catch {
    alert("Could not load payment gateway. Please check your internet connection and try again.");
    return;
  }

  const PaystackPop = (window as any).PaystackPop;
  if (!PaystackPop) {
    alert("Payment gateway failed to initialize. Please refresh and try again.");
    return;
  }

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email,
    amount: Math.round(amount * 100), // convert to pesewas
    currency,
    ref: ref || `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    callback: (response: any) => {
      onSuccess(response.reference);
    },
    onClose,
  });
  handler.openIframe();
}
