"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { auth, db, googleProvider } from "@/lib/firebase";
import { ensureDefaultCategories } from "@/lib/firestore/categories";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function ensureUserSetup(user: User) {
  const userDocRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userDocRef);
  if (!snapshot.exists()) {
    await setDoc(userDocRef, {
      displayName: user.displayName ?? "",
      email: user.email ?? "",
      baseCurrency: "UAH",
      createdAt: serverTimestamp(),
    });
  }
  await ensureDefaultCategories(user.uid);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          await ensureUserSetup(firebaseUser);
          setUser(firebaseUser);
        } else {
          setUser(null);
        }
      } catch (error) {
        // A Firestore setup failure must not leave the whole app permanently
        // on the loading screen. The user can still reach the app and retry.
        console.error("Failed to set up the user profile", error);
        setUser(firebaseUser);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUpWithEmail = useCallback(
    async (name: string, email: string, password: string) => {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
    },
    []
  );

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
