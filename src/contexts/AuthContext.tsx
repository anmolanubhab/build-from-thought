// path: src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapUser(su: SupabaseUser): User {
  return {
    id: su.id,
    email: su.email ?? "",
    name: su.user_metadata?.name ?? su.email?.split("@")[0] ?? "",
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? mapUser(session.user) : null);
      setIsLoading(false);
      if (session?.user) {
        redeemPendingReferral();
        redeemPendingWorkspaceInvite();
        redeemPendingInvitation();
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? mapUser(session.user) : null);
      setIsLoading(false);
      if (session?.user) {
        redeemPendingReferral();
        redeemPendingWorkspaceInvite();
        redeemPendingInvitation();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const redeemPendingReferral = async () => {
    const referrerId = localStorage.getItem("pending_referral_id");
    if (!referrerId) return;
    localStorage.removeItem("pending_referral_id");
    try {
      await supabase.rpc("record_referral", { p_referrer_id: referrerId });
    } catch {
      // Best-effort: a failed/duplicate redemption isn't user-facing.
    }
  };

  const redeemPendingWorkspaceInvite = async () => {
    const code = localStorage.getItem("pending_workspace_invite");
    if (!code) return;
    localStorage.removeItem("pending_workspace_invite");
    try {
      await supabase.rpc("join_workspace_by_code", { p_code: code });
    } catch {
      // Best-effort: an invalid/duplicate invite code isn't user-facing here —
      // JoinWorkspace.tsx handles the direct-link (already-logged-in) case explicitly.
    }
  };

  const redeemPendingInvitation = async () => {
    const invitationId = localStorage.getItem("pending_workspace_invitation_id");
    if (!invitationId) return;
    localStorage.removeItem("pending_workspace_invitation_id");
    try {
      await supabase.rpc("accept_workspace_invitation", { p_invitation_id: invitationId });
    } catch {
      // Best-effort: an already-accepted/revoked invitation isn't user-facing here —
      // AcceptInvite.tsx handles the direct-link (already-logged-in) case explicitly.
    }
  };

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  };

  const signup = async (name: string, email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: window.location.origin },
    });
    if (error) throw new Error(error.message);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
