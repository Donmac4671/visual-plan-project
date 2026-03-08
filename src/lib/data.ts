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
      { size: "2GB", sizeGB: 2, price: 9.80 },
      { size: "3GB", sizeGB: 3, price: 14.70 },
      { size: "5GB", sizeGB: 5, price: 24.50 },
      { size: "10GB", sizeGB: 10, price: 44 },
      { size: "15GB", sizeGB: 15, price: 65 },
      { size: "20GB", sizeGB: 20, price: 85 },
      { size: "30GB", sizeGB: 30, price: 127 },
      { size: "40GB", sizeGB: 40, price: 167 },
      { size: "50GB", sizeGB: 50, price: 207 },
    ],
  },
  {
    id: "at-bigtime",
    name: "AT BIG TIME",
    color: "bg-sky-600",
    gradient: "gradient-at-bigtime",
    bundles: [
      { size: "15GB", sizeGB: 15, price: 60 },
      { size: "20GB", sizeGB: 20, price: 72 },
      { size: "30GB", sizeGB: 30, price: 83 },
      { size: "40GB", sizeGB: 40, price: 95 },
      { size: "50GB", sizeGB: 50, price: 105 },
      { size: "60GB", sizeGB: 60, price: 117 },
      { size: "70GB", sizeGB: 70, price: 140 },
      { size: "80GB", sizeGB: 80, price: 160 },
      { size: "90GB", sizeGB: 90, price: 170 },
      { size: "100GB", sizeGB: 100, price: 190 },
      { size: "130GB", sizeGB: 130, price: 230 },
      { size: "140GB", sizeGB: 140, price: 253 },
      { size: "150GB", sizeGB: 150, price: 278 },
      { size: "200GB", sizeGB: 200, price: 390 },
    ],
  },
  {
    id: "at-premium",
    name: "AT PREMIUM",
    color: "bg-sky-700",
    gradient: "gradient-at-premium",
    bundles: [
      { size: "1GB", sizeGB: 1, price: 4.80 },
      { size: "2GB", sizeGB: 2, price: 9.60 },
      { size: "3GB", sizeGB: 3, price: 14.40 },
      { size: "4GB", sizeGB: 4, price: 19.20 },
      { size: "5GB", sizeGB: 5, price: 24 },
      { size: "6GB", sizeGB: 6, price: 28.80 },
      { size: "7GB", sizeGB: 7, price: 33.60 },
      { size: "8GB", sizeGB: 8, price: 38.40 },
      { size: "10GB", sizeGB: 10, price: 43.20 },
      { size: "12GB", sizeGB: 12, price: 52.80 },
      { size: "15GB", sizeGB: 15, price: 67.20 },
      { size: "20GB", sizeGB: 20, price: 87 },
      { size: "25GB", sizeGB: 25, price: 111 },
      { size: "30GB", sizeGB: 30, price: 135 },
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
