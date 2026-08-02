import {
  Banknote,
  Bus,
  CircleEllipsis,
  Coins,
  CreditCard,
  DollarSign,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  PiggyBank,
  PlusCircle,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  banknote: Banknote,
  bus: Bus,
  "circle-ellipsis": CircleEllipsis,
  coins: Coins,
  "credit-card": CreditCard,
  "dollar-sign": DollarSign,
  "gamepad-2": Gamepad2,
  gift: Gift,
  "graduation-cap": GraduationCap,
  "heart-pulse": HeartPulse,
  home: Home,
  landmark: Landmark,
  laptop: Laptop,
  "piggy-bank": PiggyBank,
  "plus-circle": PlusCircle,
  repeat: Repeat,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  smartphone: Smartphone,
  utensils: Utensils,
  wallet: Wallet,
};

export const WALLET_ICONS = [
  "wallet",
  "credit-card",
  "piggy-bank",
  "banknote",
  "smartphone",
  "landmark",
  "coins",
  "dollar-sign",
];

export const WALLET_COLORS = [
  "#171717",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#f97316",
  "#ef4444",
  "#eab308",
  "#06b6d4",
];

export function AppIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Wallet;
  return <Icon className={className} />;
}
