import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // Dev-only UI preview: lets a real admin see the site as another role,
  // without touching their actual database role or Supabase permissions.
  // Data operations always use the real admin rights underneath.
  const [previewRole, setPreviewRoleState] = useState(() => {
    try { return localStorage.getItem("ultraride_preview_role") || null; } catch { return null; }
  });

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (!error) setProfile(data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadProfile(data.session?.user?.id).finally(() => setLoading(false));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      loadProfile(newSession?.user?.id);
    });

    return () => listener.subscription.unsubscribe();
  }, [loadProfile]);

  // Email + password replaces the magic-link flow entirely. The profiles
  // row is still auto-created by the DB trigger on first successful sign-up.
  const signInWithPassword = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  // Sends a reset email with a recovery link pointing back to /reset-password.
  const sendPasswordReset = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  // Called from /reset-password once the recovery session is active, and
  // from the account page for a normal voluntary password change.
  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  };

  // extraData carries signup-time consent flags (marketing_consent,
  // terms_accepted) through to raw_user_meta_data, read by the
  // handle_new_user() trigger when it creates the profile row.
  const signUp = async (email, password, extraData = {}) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: extraData },
    });
    return { error };
  };

  const signOut = () => supabase.auth.signOut();

  const setPreviewRole = (role) => {
    setPreviewRoleState(role);
    try {
      if (role) localStorage.setItem("ultraride_preview_role", role);
      else localStorage.removeItem("ultraride_preview_role");
    } catch { /* localStorage unavailable, ignore */ }
  };

  const realRole = profile?.role || null;
  // Only a genuine admin can preview as something else — a real organizer
  // or participant can't use this to see admin-only UI.
  const effectiveRole = realRole === "admin" && previewRole ? previewRole : realRole;

  const value = {
    session,
    user: session?.user || null,
    profile,
    role: effectiveRole,
    realRole,
    previewRole: realRole === "admin" ? previewRole : null,
    setPreviewRole,
    isAdmin: effectiveRole === "admin",
    isOrganizer: effectiveRole === "organizer",
    loading,
    signInWithPassword,
    signUp,
    sendPasswordReset,
    updatePassword,
    signOut,
    refreshProfile: () => loadProfile(session?.user?.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
