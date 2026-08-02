export interface DefaultCategory {
  name: string;
  type: "income" | "expense";
  icon: string;
  color: string;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Expenses
  { name: "Groceries", type: "expense", icon: "shopping-cart", color: "#22c55e" },
  { name: "Cafes & Restaurants", type: "expense", icon: "utensils", color: "#f97316" },
  { name: "Transport", type: "expense", icon: "bus", color: "#3b82f6" },
  { name: "Housing & Utilities", type: "expense", icon: "home", color: "#8b5cf6" },
  { name: "Health", type: "expense", icon: "heart-pulse", color: "#ef4444" },
  { name: "Entertainment", type: "expense", icon: "gamepad-2", color: "#ec4899" },
  { name: "Shopping", type: "expense", icon: "shopping-bag", color: "#eab308" },
  { name: "Subscriptions", type: "expense", icon: "repeat", color: "#06b6d4" },
  { name: "Education", type: "expense", icon: "graduation-cap", color: "#6366f1" },
  { name: "Other", type: "expense", icon: "circle-ellipsis", color: "#737373" },
  // Income
  { name: "Salary", type: "income", icon: "banknote", color: "#16a34a" },
  { name: "Freelance", type: "income", icon: "laptop", color: "#0ea5e9" },
  { name: "Gifts", type: "income", icon: "gift", color: "#d946ef" },
  { name: "Other Income", type: "income", icon: "plus-circle", color: "#737373" },
];
