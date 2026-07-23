import type { Session } from "@supabase/supabase-js";
import { supabase } from "~/lib/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * 카카오 access token의 실제 만료 시각을 클라이언트에서 알 수 없어(Supabase가 provider
 * 토큰의 expires_in을 넘겨주지 않음) 보수적으로 짧게(1시간) 잡아둔다. 실제 발송 시점에
 * Edge Function이 이 값을 보고 필요하면 refresh_token으로 먼저 갱신한 뒤 보낸다.
 */
const ASSUMED_TOKEN_LIFETIME_MS = 60 * 60 * 1000;

/**
 * supabase.from(...)은 매 요청마다 client.auth.getSession()으로 "현재" 세션을 다시
 * 확인해 Authorization 헤더를 만든다. onAuthStateChange 콜백 안에서 곧바로 이걸 쓰면
 * (내부 만료 재확인/리프레시 타이밍에 따라) 세션을 못 찾고 조용히 anon key로 폴백해
 * auth.uid()가 비어 RLS를 통과 못하는 경우가 있었다("new row violates row-level
 * security policy"). 이 함수는 그 경로를 완전히 우회해서, 방금 로그인 이벤트로 받은
 * session.access_token을 REST 요청에 직접 실어보낸다 - 클라이언트의 세션 상태 판단에
 * 의존하지 않으므로 위 문제와 무관하게 항상 이 사용자로 인증된다.
 */
async function restUpsert(
  table: string,
  accessToken: string,
  body: Record<string, unknown>,
  onConflict?: string,
): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return "Supabase 설정이 없습니다.";

  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  if (onConflict) url.searchParams.set("on_conflict", onConflict);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(body),
  });

  return res.ok ? null : await res.text();
}

/**
 * 카카오 로그인 직후 세션에 담겨오는 provider_token(talk_message 동의 시)을
 * kakao_tokens에 저장하고, subscribers.kakao_connected를 true로 표시한다.
 * (동의하지 않았거나 카카오 로그인이 아니면 provider_token이 없어 아무것도 하지 않음)
 */
export async function persistKakaoTokensFromSession(session: Session): Promise<void> {
  if (!supabase) return;

  const accessToken = session.provider_token;
  const refreshToken = session.provider_refresh_token;
  if (!accessToken || !refreshToken) {
    console.warn("[kakao-auth] provider_token/provider_refresh_token이 세션에 없습니다.", {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
    });
    return;
  }

  const userId = session.user.id;
  const expiresAt = new Date(Date.now() + ASSUMED_TOKEN_LIFETIME_MS).toISOString();

  // RLS(auth.uid() = user_id)가 계속 실패해서, 실제로 보내는 JWT의 sub 클레임이
  // session.user.id와 정말 일치하는지, role이 authenticated인지 직접 눈으로 확인한다.
  try {
    const payloadBase64 = session.access_token.split(".")[1];
    const payload = JSON.parse(atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/")));
    console.info("[kakao-auth] JWT 확인:", {
      jwtSub: payload.sub,
      sessionUserId: userId,
      subMatchesUserId: payload.sub === userId,
      role: payload.role,
      exp: payload.exp,
      nowSec: Math.floor(Date.now() / 1000),
    });
  } catch (e) {
    console.warn("[kakao-auth] JWT 디코딩 실패:", e);
  }

  const tokenError = await restUpsert("kakao_tokens", session.access_token, {
    user_id: userId,
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
  });
  if (tokenError) {
    console.error("[kakao-auth] 카카오 토큰 저장 실패:", tokenError);
    return;
  }

  const subscriberError = await restUpsert(
    "subscribers",
    session.access_token,
    { user_id: userId, kakao_connected: true },
    "user_id",
  );
  if (subscriberError) {
    console.error("[kakao-auth] 구독 정보 갱신 실패:", subscriberError);
  } else {
    console.info("[kakao-auth] 카카오 토큰 저장 및 kakao_connected 갱신 완료");
  }
}
