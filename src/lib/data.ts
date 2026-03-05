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
      { size: "1GB", sizeGB: 1, price: 5 },
      { size: "2GB", sizeGB: 2, price: 10 },
      { size: "3GB", sizeGB: 3, price: 15 },
      { size: "4GB", sizeGB: 4, price: 20 },
      { size: "5GB", sizeGB: 5, price: 25 },
      { size: "6GB", sizeGB: 6, price: 30 },
      { size: "8GB", sizeGB: 8, price: 40 },
      { size: "10GB", sizeGB: 10, price: 46 },
      { size: "15GB", sizeGB: 15, price: 67 },
      { size: "20GB", sizeGB: 20, price: 88 },
      { size: "25GB", sizeGB: 25, price: 109 },
      { size: "30GB", sizeGB: 30, price: 130 },
      { size: "40GB", sizeGB: 40, price: 170 },
      { size: "50GB", sizeGB: 50, price: 210 },
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
    color: "bg-red-600",
    gradient: "gradient-at",
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
    color: "bg-red-700",
    gradient: "gradient-at",
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
  status: "completed" | "pending" | "failed";
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

export const sampleOrders: Order[] = [
  { id: "ORD-001", date: "2026-03-05", network: "MTN", phoneNumber: "0241234567", bundle: "2GB", amount: 10, status: "completed" },
  { id: "ORD-002", date: "2026-03-04", network: "TELECEL", phoneNumber: "0201234567", bundle: "5GB", amount: 24.50, status: "completed" },
  { id: "ORD-003", date: "2026-03-03", network: "MTN", phoneNumber: "0551234567", bundle: "10GB", amount: 46, status: "pending" },
  { id: "ORD-004", date: "2026-03-02", network: "AT BIG TIME", phoneNumber: "0261234567", bundle: "20GB", amount: 72, status: "completed" },
  { id: "ORD-005", date: "2026-03-01", network: "AT PREMIUM", phoneNumber: "0271234567", bundle: "5GB", amount: 24, status: "failed" },
];

export const sampleTransactions: Transaction[] = [
  { id: "TXN-001", date: "2026-03-05", type: "Purchase", description: "MTN 2GB Bundle", amount: -10, status: "completed" },
  { id: "TXN-002", date: "2026-03-04", type: "Top-up", description: "Wallet Top-up via MoMo", amount: 100, status: "completed" },
  { id: "TXN-003", date: "2026-03-03", type: "Purchase", description: "TELECEL 5GB Bundle", amount: -24.50, status: "completed" },
  { id: "TXN-004", date: "2026-03-02", type: "Top-up", description: "Wallet Top-up via Card", amount: 200, status: "pending" },
];

export const sampleTopUps: TopUp[] = [
  { id: "TOP-001", date: "2026-03-05", method: "Mobile Money", amount: 100, status: "completed" },
  { id: "TOP-002", date: "2026-03-04", method: "Bank Card", amount: 200, status: "completed" },
  { id: "TOP-003", date: "2026-03-03", method: "Mobile Money", amount: 50, status: "pending" },
];

export function formatCurrency(amount: number): string {
  return `₵${amount.toFixed(2)}`;
}
