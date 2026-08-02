import {
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import type { Category } from "@/lib/types";
import { categoriesRef } from "./refs";

/**
 * Creates the default category set on first sign-in.
 * No-op if the user already has categories.
 */
export async function ensureDefaultCategories(uid: string): Promise<void> {
  const snapshot = await getDocs(categoriesRef(uid));
  if (!snapshot.empty) return;

  const batch = writeBatch(db);
  for (const cat of DEFAULT_CATEGORIES) {
    const ref = doc(categoriesRef(uid));
    batch.set(ref, { id: ref.id, isDefault: true, ...cat });
  }
  await batch.commit();
}

export function subscribeToCategories(
  uid: string,
  callback: (categories: Category[]) => void
): () => void {
  const q = query(categoriesRef(uid), orderBy("name"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => d.data()));
  });
}
