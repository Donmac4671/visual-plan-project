export interface DataBundle {
  size: string;
  sizeGB: number;
  price: number;
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
      { size: "1GB", sizeGB: 1, price: 4.60 },
      { size: "2GB", sizeGB: 2, price: 9.60 },
      { size: "3GB", sizeGB: 3, price: 14 },
      { size: "4GB", sizeGB: 4, price: 18.50 },
      { size: "5GB", sizeGB: 5, price: 23.50 },
      { size: "6GB", sizeGB: 6, price: 28 },
      { size: "8GB", sizeGB: 8, price: 37 },
      { size: "10GB", sizeGB: 10, price: 43.50 },
      { size: "15GB", sizeGB: 15, price: 64 },
      { size: "20GB", sizeGB: 20, price: 84 },
      { size: "25GB", sizeGB: 25, price: 105 },
      { size: "30GB", sizeGB: 30, price: 126 },
      { size: "40GB", sizeGB: 40, price: 164 },
      { size: "50GB", sizeGB: 50, price: 205 },
    ],
  },
  {
    id: "telecel",
    name: "TELECEL",
    color: "bg-red-500",
    gradient: "gradient-telecel",
    bundles: [
      { size: "2GB", sizeGB: 2, price: 9.60 },
      { size: "3GB", sizeGB: 3, price: 14.20 },
      { size: "5GB", sizeGB: 5, price: 23 },
      { size: "10GB", sizeGB: 10, price: 42 },
      { size: "15GB", sizeGB: 15, price: 62 },
      { size: "20GB", sizeGB: 20, price: 82 },
      { size: "30GB", sizeGB: 30, price: 123 },
      { size: "40GB", sizeGB: 40, price: 163 },
      { size: "50GB", sizeGB: 50, price: 202 },
    ],
  },
  {
    id: "at-bigtime",
    name: "AT BIG TIME",
    color: "bg-sky-600",
    gradient: "gradient-at-bigtime",
    bundles: [
      { size: "15GB", sizeGB: 15, price: 56 },
      { size: "20GB", sizeGB: 20, price: 68 },
      { size: "30GB", sizeGB: 30, price: 78 },
      { size: "40GB", sizeGB: 40, price: 90 },
      { size: "50GB", sizeGB: 50, price: 100 },
      { size: "60GB", sizeGB: 60, price: 112 },
      { size: "70GB", sizeGB: 70, price: 135 },
      { size: "80GB", sizeGB: 80, price: 154 },
      { size: "90GB", sizeGB: 90, price: 164 },
      { size: "100GB", sizeGB: 100, price: 184 },
      { size: "130GB", sizeGB: 130, price: 230 },
      { size: "140GB", sizeGB: 140, price: 246 },
      { size: "150GB", sizeGB: 150, price: 270 },
      { size: "200GB", sizeGB: 200, price: 380 },
    ],
  },
  {
    id: "at-premium",
    name: "AT PREMIUM",
    color: "bg-sky-700",
    gradient: "gradient-at-premium",
    bundles: [
      { size: "1GB", sizeGB: 1, price: 4.50 },
      { size: "2GB", sizeGB: 2, price: 9.20 },
      { size: "3GB", sizeGB: 3, price: 13.80 },
      { size: "4GB", sizeGB: 4, price: 18.30 },
      { size: "5GB", sizeGB: 5, price: 23 },
      { size: "6GB", sizeGB: 6, price: 27.50 },
      { size: "7GB", sizeGB: 7, price: 32 },
      { size: "8GB", sizeGB: 8, price: 36.50 },
      { size: "10GB", sizeGB: 10, price: 41.20 },
      { size: "12GB", sizeGB: 12, price: 50 },
      { size: "15GB", sizeGB: 15, price: 63 },
      { size: "20GB", sizeGB: 20, price: 82 },
      { size: "25GB", sizeGB: 25, price: 105 },
      { size: "30GB", sizeGB: 30, price: 129 },
    ],
  },
];

export interface CartItem {
  id: string;
  network: string;
  networkId: string;
  bundle: DataBundle;
  phoneNumber: string;
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

export const PAYSTACK_FEE_PERCENT = 0.02; // 2%

export function calculatePaystackFee(amount: number): number {
  return Math.round(amount * PAYSTACK_FEE_PERCENT * 100) / 100;
}

export function formatCurrency(amount: number): string {
  return `₵${amount.toFixed(2)}`;
}
