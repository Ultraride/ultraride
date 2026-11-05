import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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

  // Google / Apple. Le retour se fait sur /auth/callback (voir AuthCallback.jsx).
  const signInWithProvider = async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: provider === "google" ? { prompt: "select_account" } : undefined,
      },
    });
    return { error };
  };

  // Code à 6 chiffres par email. create=false à la connexion (pas de création
  // de compte implicite) ; à l'inscription, extraData porte rôle + consentements
  // jusqu'au trigger handle_new_user(), comme pour signUp.
  const sendEmailCode = async (email, { create = false, extraData } = {}) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: create, data: create ? extraData : undefined },
    });
    return { error };
  };

  const verifyEmailCode = async (email, token) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    return { error };
  };

  // Comptes créés via Google / Apple : rôle + CGU choisis après coup (/bienvenue).
  const completeOnboarding = async ({ role, terms, marketing }) => {
    const { error } = await supabase.rpc("complete_oauth_onboarding", {
      p_role: role,
      p_terms: terms,
      p_marketing: marketing,
    });
    if (!error) {
      await supabase.auth.refreshSession();
      await loadProfile(session?.user?.id);
    }
    return { error };
  };

  const signOut = () => supabase.auth.signOut();

  const role = profile?.role || null;
  const user = session?.user || null;
  const providers = user?.app_metadata?.providers || [user?.app_metadata?.provider].filter(Boolean);
  const needsOnboarding =
    !!user &&
    !user.user_metadata?.requested_role &&
    providers.some((p) => p === "google" || p === "apple");

  const value = {
    session,
    user,
    profile,
    needsOnboarding,
    signInWithProvider,
    sendEmailCode,
    verifyEmailCode,
    completeOnboarding,
    role,
    isAdmin: role === "admin",
    isOrganizer: role === "organizer",
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
