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
      // Supabase는 OAuth 리다이렉트 직후 페이지 로드 시 "SIGNED_IN"이 아니라
      // "INITIAL_SESSION"으로 세션을 알려준다 - provider_token도 이 이벤트에 실려오므로
      // 같이 처리해야 한다(SIGNED_IN만 보면 카카오 토큰을 영영 못 잡는다).
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
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
