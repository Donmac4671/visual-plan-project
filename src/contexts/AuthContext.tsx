import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  agent_code: string;
  wallet_balance: number;
  is_blocked: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const clearStoredSession = () => {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("sb-") && key.includes("-auth-token"))
      .forEach((key) => localStorage.removeItem(key));
  };

  const isAnonymousSession = (authUser: User) => {
    const provider = (authUser.app_metadata as { provider?: string } | undefined)?.provider;
    return provider === "anonymous" || (authUser as User & { is_anonymous?: boolean }).is_anonymous === true;
  };

  const fetchProfile = async (authUser: User) => {
    try {
      let { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profile fetch error:", profileError.message);
      }

      if (!profileData) {
        const { data: createdProfile, error: createError } = await supabase
          .from("profiles")
          .insert({
            user_id: authUser.id,
            full_name: (authUser.user_metadata as { full_name?: string } | undefined)?.full_name ?? "",
            email: authUser.email ?? "",
            phone: (authUser.user_metadata as { phone?: string } | undefined)?.phone ?? "",
          })
          .select("*")
          .single();

        if (createError) {
          console.error("Profile bootstrap error:", createError.message);
        } else {
          profileData = createdProfile;
        }
      }

      setProfile((profileData as Profile) ?? null);

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authUser.id);

      if (rolesError) {
        console.error("Role fetch error:", rolesError.message);
      }

      setIsAdmin(roles?.some((r) => r.role === "admin") ?? false);
    } catch (error) {
      console.error("Auth profile load failed:", error);
      setProfile(null);
      setIsAdmin(false);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user);
  };

  useEffect(() => {
    let isMounted = true;
    const loadingGuard = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 8000);

    const hydrate = async (sessionUser: User | null) => {
      if (!isMounted) return;

      if (sessionUser && isAnonymousSession(sessionUser)) {
        await supabase.auth.signOut({ scope: "global" }).catch(() => undefined);
        clearStoredSession();
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        if (isMounted) setLoading(false);
        return;
      }

      setUser(sessionUser);

      if (sessionUser) {
        await fetchProfile(sessionUser);
      } else {
        setProfile(null);
        setIsAdmin(false);
      }

      if (isMounted) setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await hydrate(session?.user ?? null);
    });

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!session) {
          await hydrate(null);
          return;
        }

        const { data: { user: validatedUser }, error } = await supabase.auth.getUser();
        if (error || !validatedUser) {
          await supabase.auth.signOut({ scope: "global" }).catch(() => undefined);
          clearStoredSession();
          await hydrate(null);
          return;
        }

        await hydrate(validatedUser);
      })
      .catch((error) => {
        console.error("Session load failed:", error);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      clearTimeout(loadingGuard);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (error) {
      console.error("Sign out failed:", error);
    } finally {
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      clearStoredSession();
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

