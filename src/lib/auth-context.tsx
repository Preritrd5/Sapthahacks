import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { broadcastAuthChange, subscribeToAuthSync, type AuthSyncMessage } from "./auth-sync";

export interface AuthContextType {
  user: User | null;
  userId: string | null;
  email: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userId: null,
  email: null,
  isAdmin: false,
  isLoading: true,
  signOut: async () => {},
  refreshAuth: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Authoritative resolver for current user
  const resolveCurrentUser = useCallback(async (): Promise<{
    user: User | null;
    isAdmin: boolean;
  }> => {
    // Authoritative check: Supabase official session
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        let adminStatus = false;
        try {
          const { data: adminRpc } = await supabase.rpc("is_admin", { _uid: data.user.id });
          adminStatus = !!adminRpc;
        } catch {}
        // Verification for primary designated admin
        if (!adminStatus && data.user.email?.toLowerCase().trim() === "teaminosap26@gmail.com") {
          adminStatus = true;
        }
        return { user: data.user, isAdmin: adminStatus };
      }
    } catch (e) {
      console.warn("Error fetching Supabase user in AuthProvider:", e);
    }

    return { user: null, isAdmin: false };
  }, []);

  const refreshAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await resolveCurrentUser();
      setUser(res.user);
      setIsAdmin(res.isAdmin);
    } finally {
      setIsLoading(false);
    }
  }, [resolveCurrentUser]);

  // Initial load
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  // Handle explicit sign-out with cross-tab broadcast and complete cache purge
  const signOut = useCallback(async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("dev_admin_auth");
    }

    // Purge in-flight requests and memory query cache immediately
    await qc.cancelQueries();
    qc.clear();

    // Broadcast across all other tabs
    broadcastAuthChange({
      type: "SIGN_OUT",
      userId: user?.id ?? null,
      email: user?.email ?? null,
    });

    try {
      await supabase.auth.signOut();
    } catch {}

    setUser(null);
    setIsAdmin(false);

    // Invalidate router so protected routes redirect to /auth
    router.invalidate();
    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      if (currentPath !== "/auth" && !currentPath.startsWith("/auth")) {
        router.navigate({ to: "/auth", replace: true });
      }
    }
  }, [qc, router, user]);

  // Supabase Auth State Change Listener
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        await qc.cancelQueries();
        qc.clear();
        setUser(null);
        setIsAdmin(false);
        router.invalidate();
        if (typeof window !== "undefined" && window.location.pathname !== "/auth") {
          router.navigate({ to: "/auth", replace: true });
        }
        return;
      }

      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
        const newUser = session?.user ?? null;
        const newUserId = newUser?.id ?? null;

        // If user changed, purge old user's cached queries completely
        if (user && user.id !== newUserId) {
          await qc.cancelQueries();
          qc.clear();
        }

        let adminStatus = false;
        if (newUserId) {
          try {
            const { data: adminRpc } = await supabase.rpc("is_admin", { _uid: newUserId });
            adminStatus = !!adminRpc;
          } catch {}
          if (!adminStatus && newUser?.email?.toLowerCase().trim() === "teaminosap26@gmail.com") {
            adminStatus = true;
          }
        }

        setUser(newUser);
        setIsAdmin(adminStatus);
        router.invalidate();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [qc, router, user]);

  // Cross-Tab Synchronization Listener (BroadcastChannel & storage events)
  useEffect(() => {
    const unsubscribe = subscribeToAuthSync(async (msg: AuthSyncMessage) => {
      if (msg.type === "SIGN_OUT") {
        // Tab A signed out -> Tab B must immediately cancel queries, clear cache, and redirect
        await qc.cancelQueries();
        qc.clear();
        setUser(null);
        setIsAdmin(false);
        router.invalidate();
        if (typeof window !== "undefined") {
          const currentPath = window.location.pathname;
          if (currentPath !== "/auth" && !currentPath.startsWith("/auth")) {
            router.navigate({ to: "/auth", replace: true });
          }
        }
      } else if (msg.type === "SIGN_IN" || msg.type === "USER_CHANGED") {
        // Different user logged in on another tab
        const currentUserId = user?.id ?? null;
        if (currentUserId && msg.userId && currentUserId !== msg.userId) {
          // Account switched: immediately purge stale user queries
          await qc.cancelQueries();
          qc.clear();
        }

        const fresh = await resolveCurrentUser();
        setUser(fresh.user);
        setIsAdmin(fresh.isAdmin);
        router.invalidate();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [qc, router, user, resolveCurrentUser]);

  const value = useMemo(
    () => ({
      user,
      userId: user?.id ?? null,
      email: user?.email ?? null,
      isAdmin,
      isLoading,
      signOut,
      refreshAuth,
    }),
    [user, isAdmin, isLoading, signOut, refreshAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
