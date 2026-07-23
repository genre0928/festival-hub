import { createContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "~/lib/supabase/client";
import { persistKakaoTokensFromSession } from "~/lib/kakao-auth";

interface AuthContextValue {
  user: User | null;
  /** 초기 세션 확인이 끝나기 전이면 true */
  loading: boolean;
  /** Supabase가 설정돼 있어야 로그인 기능을 쓸 수 있음 */
  isAuthAvailable: boolean;
  signInWithKakao: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_IN" && session) {
        persistKakaoTokensFromSession(session);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthAvailable: !!supabase,
      signInWithKakao: async () => {
        if (!supabase) return;
        await supabase.auth.signInWithOAuth({
          provider: "kakao",
          options: {
            redirectTo: window.location.origin,
            scopes: "talk_message",
          },
        });
      },
      signOut: async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
