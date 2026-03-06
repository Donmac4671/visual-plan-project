const PAYSTACK_PUBLIC_KEY = "pk_live_6c14e62b602fe818a0433130f1db628a98731304";

interface PaystackConfig {
  email: string;
  amount: number; // in kobo (pesewas) - multiply GHS by 100
  currency?: string;
  ref?: string;
  onSuccess: (reference: string) => void;
  onClose: () => void;
}

export function initPaystack({ email, amount, currency = "GHS", ref, onSuccess, onClose }: PaystackConfig) {
  const handler = (window as any).PaystackPop?.setup({
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
  handler?.openIframe();
}
