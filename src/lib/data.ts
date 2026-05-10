export interface DataBundle {
  size: string;
  sizeGB: number;
  price: number;        // agent price
  generalPrice: number; // general user price
}

export interface Network {
  id: string;
  name: string;
  color: string;
  gradient: string;
  bundles: DataBundle[];
}

export const networks: Network[] = [
  {
    id: "mtn",
    name: "MTN",
    color: "bg-yellow-400",
    gradient: "gradient-mtn",
    bundles: [
      { size: "1GB", sizeGB: 1, price: 4.60, generalPrice: 5 },
      { size: "2GB", sizeGB: 2, price: 9.30, generalPrice: 10 },
      { size: "3GB", sizeGB: 3, price: 13.90, generalPrice: 15 },
      { size: "4GB", sizeGB: 4, price: 18.50, generalPrice: 20 },
      { size: "5GB", sizeGB: 5, price: 23.20, generalPrice: 25 },
      { size: "6GB", sizeGB: 6, price: 27.80, generalPrice: 30 },
      { size: "8GB", sizeGB: 8, price: 37, generalPrice: 40 },
      { size: "10GB", sizeGB: 10, price: 43.50, generalPrice: 46 },
      { size: "15GB", sizeGB: 15, price: 64, generalPrice: 67 },
      { size: "20GB", sizeGB: 20, price: 84, generalPrice: 88 },
      { size: "25GB", sizeGB: 25, price: 105, generalPrice: 109 },
      { size: "30GB", sizeGB: 30, price: 126, generalPrice: 130 },
      { size: "40GB", sizeGB: 40, price: 164, generalPrice: 170 },
      { size: "50GB", sizeGB: 50, price: 205, generalPrice: 210 },
    ],
  },
  {
    id: "telecel",
    name: "TELECEL",
    color: "bg-red-500",
    gradient: "gradient-telecel",
    bundles: [
      { size: "2GB", sizeGB: 2, price: 10.20, generalPrice: 11 },
      { size: "3GB", sizeGB: 3, price: 15.40, generalPrice: 16.50 },
      { size: "5GB", sizeGB: 5, price: 23, generalPrice: 24.50 },
      { size: "10GB", sizeGB: 10, price: 42, generalPrice: 44 },
      { size: "15GB", sizeGB: 15, price: 62, generalPrice: 65 },
      { size: "20GB", sizeGB: 20, price: 82, generalPrice: 85 },
      { size: "25GB", sizeGB: 25, price: 100, generalPrice: 105 },
      { size: "30GB", sizeGB: 30, price: 123, generalPrice: 127 },
      { size: "40GB", sizeGB: 40, price: 163, generalPrice: 167 },
      { size: "50GB", sizeGB: 50, price: 202, generalPrice: 207 },
    ],
  },
  {
    id: "at-bigtime",
    name: "AT BIG TIME",
    color: "bg-sky-600",
    gradient: "gradient-at-bigtime",
    bundles: [
      { size: "15GB", sizeGB: 15, price: 58, generalPrice: 60 },
      { size: "20GB", sizeGB: 20, price: 65, generalPrice: 68 },
      { size: "30GB", sizeGB: 30, price: 75, generalPrice: 80 },
      { size: "40GB", sizeGB: 40, price: 86, generalPrice: 92 },
      { size: "50GB", sizeGB: 50, price: 95, generalPrice: 104 },
      { size: "60GB", sizeGB: 60, price: 106, generalPrice: 116 },
      { size: "70GB", sizeGB: 70, price: 138, generalPrice: 143 },
      { size: "80GB", sizeGB: 80, price: 152, generalPrice: 158 },
      { size: "90GB", sizeGB: 90, price: 163, generalPrice: 170 },
      { size: "100GB", sizeGB: 100, price: 177, generalPrice: 184 },
      { size: "130GB", sizeGB: 130, price: 222, generalPrice: 230 },
      { size: "140GB", sizeGB: 140, price: 248, generalPrice: 256 },
      { size: "150GB", sizeGB: 150, price: 275, generalPrice: 285 },
      { size: "200GB", sizeGB: 200, price: 370, generalPrice: 380 },
    ],
  },
  {
    id: "at-premium",
    name: "AT PREMIUM",
    color: "bg-sky-700",
    gradient: "gradient-at-premium",
    bundles: [
      { size: "1GB", sizeGB: 1, price: 4.40, generalPrice: 4.80 },
      { size: "2GB", sizeGB: 2, price: 8.90, generalPrice: 9.60 },
      { size: "3GB", sizeGB: 3, price: 13.40, generalPrice: 14.40 },
      { size: "4GB", sizeGB: 4, price: 17.80, generalPrice: 19.20 },
      { size: "5GB", sizeGB: 5, price: 22.20, generalPrice: 24 },
      { size: "6GB", sizeGB: 6, price: 26.80, generalPrice: 28.80 },
      { size: "7GB", sizeGB: 7, price: 31.30, generalPrice: 33.60 },
      { size: "8GB", sizeGB: 8, price: 35.70, generalPrice: 38.40 },
      { size: "10GB", sizeGB: 10, price: 41.20, generalPrice: 43.20 },
      { size: "12GB", sizeGB: 12, price: 50, generalPrice: 55 },
      { size: "15GB", sizeGB: 15, price: 63, generalPrice: 67 },
      { size: "20GB", sizeGB: 20, price: 82, generalPrice: 85.40 },
      { size: "25GB", sizeGB: 25, price: 105, generalPrice: 109.40 },
      { size: "30GB", sizeGB: 30, price: 125, generalPrice: 129.60 },
    ],
  },
];

export interface CartItem {
  id: string;
  network: string;
  networkId: string;
  bundle: DataBundle;
  phoneNumber: string;
  /** The actual price charged (tier-dependent) */
  effectivePrice: number;
}

export interface Order {
  id: string;
  date: string;
  network: string;
  phoneNumber: string;
  bundle: string;
  amount: number;
  status: "completed" | "pending" | "processing" | "failed";
}

export interface Transaction {
  id: string;
  date: string;
  type: string;
  description: string;
  amount: number;
  status: "completed" | "pending" | "failed";
}

export interface TopUp {
  id: string;
  date: string;
  method: string;
  amount: number;
  status: "completed" | "pending" | "failed";
}

export interface MashupPackage {
  price: number;     // Cedis the user pays for the package itself (before fees)
  data: string;      // e.g. "15.27 MB"
  minutes: string;   // e.g. "15.64 Minutes"
  label: string;     // human readable summary
}

export const MASHUP_PACKAGES: MashupPackage[] = [
  { price: 1, data: "15.27 MB", minutes: "15.64 Minutes", label: "₵1 — 15.27 MB & 15.64 Minutes" },
  { price: 2, data: "30.53 MB", minutes: "31.27 Minutes", label: "₵2 — 30.53 MB & 31.27 Minutes" },
  { price: 3, data: "48.8 MB", minutes: "46.92 Minutes", label: "₵3 — 48.8 MB & 46.92 Minutes" },
  { price: 4, data: "61.07 MB", minutes: "62.55 Minutes", label: "₵4 — 61.07 MB & 62.55 Minutes" },
  { price: 5, data: "86.12 MB", minutes: "83.24 Minutes", label: "₵5 — 86.12 MB & 83.24 Minutes" },
  { price: 6, data: "103.35 MB", minutes: "99.88 Minutes", label: "₵6 — 103.35 MB & 99.88 Minutes" },
  { price: 7, data: "120.27 MB", minutes: "116.53 Minutes", label: "₵7 — 120.27 MB & 116.53 Minutes" },
  { price: 8, data: "137 MB", minutes: "133.18 Minutes", label: "₵8 — 137 MB & 133.18 Minutes" },
  { price: 9, data: "155.02 MB", minutes: "149.83 Minutes", label: "₵9 — 155.02 MB & 149.83 Minutes" },
  { price: 10, data: "180.72 MB", minutes: "173.39 Minutes", label: "₵10 — 180.72 MB & 173.39 Minutes" },
  { price: 15, data: "271.07 MB", minutes: "260.08 Minutes", label: "₵15 — 271.07 MB & 260.08 Minutes" },
  { price: 20, data: "361.43 MB", minutes: "346.78 Minutes", label: "₵20 — 361.43 MB & 346.78 Minutes" },
  { price: 25, data: "451.79 MB", minutes: "433.48 Minutes", label: "₵25 — 451.79 MB & 433.48 Minutes" },
  { price: 29.99, data: "541.97 MB", minutes: "520 Minutes", label: "₵29.99 — 541.97 MB & 520 Minutes" },
];

export const MASHUP_FEE_PERCENT = 0.05; // 5% fee added on top of the package price
export const AIRTIME_MIN = 0.5;
export const AIRTIME_MAX = 100;

export function calculateMashupFee(amount: number): number {
  return Math.round(amount * MASHUP_FEE_PERCENT * 100) / 100;
}

export interface TelecelVSPackage {
  price: number;
  minutes: string;
  sms: string;
  validity?: string; // optional, e.g., "7 days"
  allNetworks?: boolean; // can call all networks
  label: string;
}

export const TELECEL_VS_PACKAGES: TelecelVSPackage[] = [
  { price: 1, minutes: "21 Minutes", sms: "5 SMS", label: "₵1 — 21 Minutes + 5 SMS" },
  { price: 2, minutes: "43 Minutes", sms: "5 SMS", label: "₵2 — 43 Minutes + 5 SMS" },
  { price: 3, minutes: "64 Minutes", sms: "5 SMS", label: "₵3 — 64 Minutes + 5 SMS" },
  { price: 4, minutes: "84 Minutes", sms: "5 SMS", label: "₵4 — 84 Minutes + 5 SMS" },
  { price: 5, minutes: "114 Minutes", sms: "10 SMS", label: "₵5 — 114 Minutes + 10 SMS" },
  { price: 6, minutes: "137 Minutes", sms: "10 SMS", label: "₵6 — 137 Minutes + 10 SMS" },
  { price: 7, minutes: "160 Minutes", sms: "10 SMS", label: "₵7 — 160 Minutes + 10 SMS" },
  { price: 8, minutes: "183 Minutes", sms: "10 SMS", label: "₵8 — 183 Minutes + 10 SMS" },
  { price: 9, minutes: "206 Minutes", sms: "10 SMS", label: "₵9 — 206 Minutes + 10 SMS" },
  { price: 10, minutes: "236 Minutes", sms: "50 SMS", label: "₵10 — 236 Minutes + 50 SMS" },
  { price: 15, minutes: "354 Minutes", sms: "50 SMS", label: "₵15 — 354 Minutes + 50 SMS" },
  { price: 20, minutes: "486 Minutes", sms: "50 SMS", label: "₵20 — 486 Minutes + 50 SMS" },
  { price: 25, minutes: "607 Minutes", sms: "50 SMS", label: "₵25 — 607 Minutes + 50 SMS" },
  { price: 29.99, minutes: "729 Minutes", sms: "50 SMS", label: "₵29.99 — 729 Minutes + 50 SMS" },
  { price: 7, minutes: "200 Minutes", sms: "All Networks", validity: "7 days", allNetworks: true, label: "Special ₵7 — 200 Minutes (All Networks, 7 days)" },
];

export const TELECEL_VS_FEE_PERCENT = 0.10; // 10% fee at checkout

export function calculateTelecelVSFee(amount: number): number {
  return Math.round(amount * TELECEL_VS_FEE_PERCENT * 100) / 100;
}

export const PAYSTACK_FEE_PERCENT = 0.02; // 2%

export const MIN_TOPUP_AGENT = 20;
export const MIN_TOPUP_GENERAL = 5;

export function getMinTopUp(tier: string): number {
  return tier === "agent" ? MIN_TOPUP_AGENT : MIN_TOPUP_GENERAL;
}

export function calculatePaystackFee(amount: number): number {
  return Math.round(amount * PAYSTACK_FEE_PERCENT * 100) / 100;
}

export function formatCurrency(amount: number): string {
  return `₵${amount.toFixed(2)}`;
}

/** Get the price for a bundle based on user tier */
export function getBundlePrice(bundle: DataBundle, tier: string): number {
  return tier === "agent" ? bundle.price : bundle.generalPrice;
}
