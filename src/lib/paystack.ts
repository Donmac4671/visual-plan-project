const PAYSTACK_PUBLIC_KEY = "pk_live_6c14e62b602fe818a0433130f1db628a98731304";

interface PaystackConfig {
  email: string;
  amount: number; // in GHS - will be converted to pesewas
  currency?: string;
  ref?: string;
  onSuccess: (reference: string) => void;
  onClose: () => void;
}

type LegacyPaystackHandler = {
  openIframe: () => void;
};

type LegacyPaystackPop = {
  setup: (config: Record<string, unknown>) => LegacyPaystackHandler;
};

type V2PaystackInstance = {
  newTransaction: (config: Record<string, unknown>) => void;
};

type V2PaystackConstructor = new () => V2PaystackInstance;

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const hasLegacy = typeof (window as any).PaystackPop?.setup === "function";
    const hasV2 = typeof (window as any).PaystackPop === "function";

    if (hasLegacy || hasV2) {
      resolve();
      return;
    }

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

  const amountInMinorUnit = Math.round(amount * 100);
  const reference = ref || `txn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const paystackGlobal = (window as any).PaystackPop;

  try {
    if (typeof paystackGlobal?.setup === "function") {
      const legacyPaystack = paystackGlobal as LegacyPaystackPop;
      const handler = legacyPaystack.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email,
        amount: amountInMinorUnit,
        currency,
        ref: reference,
        callback: (response: any) => onSuccess(response.reference),
        onClose,
      });
      handler.openIframe();
      return;
    }

    if (typeof paystackGlobal === "function") {
      const v2Paystack = new (paystackGlobal as V2PaystackConstructor)();
      v2Paystack.newTransaction({
        key: PAYSTACK_PUBLIC_KEY,
        email,
        amount: amountInMinorUnit,
        currency,
        reference,
        onSuccess: (transaction: any) => onSuccess(transaction.reference),
        onCancel: onClose,
      });
      return;
    }
  } catch (error) {
    console.error("Paystack initialization error:", error);
  }

  alert("Payment gateway failed to initialize. Please refresh and try again.");
}

