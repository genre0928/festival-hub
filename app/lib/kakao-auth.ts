import type { Session } from "@supabase/supabase-js";
import { supabase } from "~/lib/supabase/client";
import type { Database } from "~/lib/supabase/types";

type KakaoTokenInsert = Database["public"]["Tables"]["kakao_tokens"]["Insert"];
type SubscriberInsert = Database["public"]["Tables"]["subscribers"]["Insert"];

/**
 * 카카오 access token의 실제 만료 시각을 클라이언트에서 알 수 없어(Supabase가 provider
 * 토큰의 expires_in을 넘겨주지 않음) 보수적으로 짧게(1시간) 잡아둔다. 실제 발송 시점에
 * Edge Function이 이 값을 보고 필요하면 refresh_token으로 먼저 갱신한 뒤 보낸다.
 */
const ASSUMED_TOKEN_LIFETIME_MS = 60 * 60 * 1000;

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

  // onAuthStateChange 콜백 안에서 곧바로 REST 호출을 하면, 클라이언트가 이 세션을
  // 내부 상태(및 이후 요청에 실어보낼 Authorization 헤더)에 완전히 반영하기 전에
  // 요청이 나가 auth.uid()가 null로 잡혀 RLS를 통과 못하는 경우가 있다("new row
  // violates row-level security policy"). setSession으로 이 세션을 명시적으로
  // 확정지어 이후 요청이 반드시 이 사용자로 인증되게 한다.
  const { error: setSessionError } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (setSessionError) {
    console.error("[kakao-auth] 세션 확정 실패:", setSessionError.message);
    return;
  }

  const userId = session.user.id;
  const expiresAt = new Date(Date.now() + ASSUMED_TOKEN_LIFETIME_MS).toISOString();

  const tokenPayload: KakaoTokenInsert = {
    user_id: userId,
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
  };
  const { error: tokenError } = await supabase.from("kakao_tokens").upsert(tokenPayload);
  if (tokenError) {
    console.error("[kakao-auth] 카카오 토큰 저장 실패:", tokenError.message);
    return;
  }

  const subscriberPayload: SubscriberInsert = { user_id: userId, kakao_connected: true };
  const { error: subscriberError } = await supabase
    .from("subscribers")
    .upsert(subscriberPayload, { onConflict: "user_id" });
  if (subscriberError) {
    console.error("[kakao-auth] 구독 정보 갱신 실패:", subscriberError.message);
  } else {
    console.info("[kakao-auth] 카카오 토큰 저장 및 kakao_connected 갱신 완료");
  }
}
