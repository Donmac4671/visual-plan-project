import React, { createContext, useContext, useState, ReactNode } from "react";
import { CartItem, DataBundle } from "@/lib/data";

interface CartContextType {
  items: CartItem[];
  addItem: (networkId: string, networkName: string, bundle: DataBundle, phoneNumber: string) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (networkId: string, networkName: string, bundle: DataBundle, phoneNumber: string) => {
    const newItem: CartItem = {
      id: `${Date.now()}-${Math.random()}`,
      network: networkName,
      networkId,
      bundle,
      phoneNumber,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, item) => sum + item.bundle.price, 0);
  const itemCount = items.length;

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, total, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
