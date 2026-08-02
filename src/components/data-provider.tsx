"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth-provider";
import { subscribeToCategories } from "@/lib/firestore/categories";
import { subscribeToWallets } from "@/lib/firestore/wallets";
import type { Category, Wallet } from "@/lib/types";

interface DataContextValue {
  wallets: Wallet[];
  categories: Category[];
  walletsLoading: boolean;
}

const DataContext = createContext<DataContextValue | null>(null);

/** Subscribes to the user's wallets and categories once for the whole app. */
export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setWallets([]);
      setCategories([]);
      return;
    }
    const unsubWallets = subscribeToWallets(user.uid, (next) => {
      setWallets(next);
      setWalletsLoading(false);
    });
    const unsubCategories = subscribeToCategories(user.uid, setCategories);
    return () => {
      unsubWallets();
      unsubCategories();
    };
  }, [user]);

  return (
    <DataContext.Provider value={{ wallets, categories, walletsLoading }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within DataProvider");
  return context;
}
