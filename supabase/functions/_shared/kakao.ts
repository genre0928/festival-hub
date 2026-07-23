// 카카오 액세스 토큰 조회/갱신 + "나에게 보내기" 발송 공통 로직.
// send-new-festival-alerts, send-digest Edge Function에서 공유해서 쓴다.
//
// 카카오톡 "나에게 보내기"(/v2/api/talk/memo/default/send)는 항상 access_token의
// 발급 대상 본인에게만 보낼 수 있다. 즉 구독자 각자가 카카오 로그인 시 자기 talk_message
// 스코프 토큰을 kakao_tokens에 저장해두고, 여기서는 그 토큰으로 "본인에게" 알림을 보낸다.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const KAKAO_SEND_URL = "https://kapi.kakao.com/v2/api/talk/memo/default/send";

/** 만료 5분 전부터는 미리 갱신해, 발송 도중에 만료되는 것을 방지한다. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** 카카오 기본 텍스트 템플릿의 text 필드 길이 제한(200자)에 여유를 두고 자른다. */
const MESSAGE_MAX_LENGTH = 180;

export interface KakaoTokenRow {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

/**
 * 저장된 kakao_tokens 행을 필요시 갱신해 유효한 access_token을 반환한다.
 * 갱신에 성공하면 DB에도 새 토큰을 반영한다.
 * refresh_token 자체가 만료/폐기된 경우(연결 해제 등) null을 반환한다 — 호출측은 이 경우
 * subscribers.kakao_connected를 false로 내리고 해당 사용자에 대한 발송을 건너뛰어야 한다.
 */
export async function getValidKakaoAccessToken(
  supabase: SupabaseClient,
  token: KakaoTokenRow,
  restApiKey: string,
  clientSecret?: string,
): Promise<string | null> {
  const expiresAt = new Date(token.expires_at).getTime();
  const needsRefresh = Number.isNaN(expiresAt) || expiresAt - Date.now() < REFRESH_MARGIN_MS;
  if (!needsRefresh) return token.access_token;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: restApiKey,
    refresh_token: token.refresh_token,
  });
  if (clientSecret) body.set("client_secret", clientSecret);

  const res = await fetch(KAKAO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    console.error(`카카오 토큰 갱신 실패 (user_id=${token.user_id}, HTTP ${res.status}): ${await res.text()}`);
    return null;
  }

  const json = await res.json();
  const newAccessToken: string | undefined = json.access_token;
  const newRefreshToken: string | undefined = json.refresh_token; // 카카오가 회전시키는 경우에만 내려옴
  const expiresIn: number | undefined = json.expires_in; // 초 단위
  if (!newAccessToken || !expiresIn) return null;

  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const { error } = await supabase
    .from("kakao_tokens")
    .update({
      access_token: newAccessToken,
      ...(newRefreshToken ? { refresh_token: newRefreshToken } : {}),
      expires_at: newExpiresAt,
    })
    .eq("user_id", token.user_id);

  if (error) {
    console.error(`카카오 토큰 갱신 후 DB 저장 실패 (user_id=${token.user_id}):`, error.message);
  }

  return newAccessToken;
}

export interface KakaoMessage {
  text: string;
  webUrl: string;
  buttonTitle?: string;
}

/**
 * "나에게 보내기"로 카카오톡 메시지를 발송한다.
 * 성공 시 true, 실패 시 false를 반환한다(호출측이 한 사용자 실패로 전체 배치를 중단하지 않도록
 * 예외를 던지지 않고 결과를 값으로 돌려준다).
 */
export async function sendKakaoMemo(accessToken: string, message: KakaoMessage): Promise<boolean> {
  const text =
    message.text.length > MESSAGE_MAX_LENGTH
      ? `${message.text.slice(0, MESSAGE_MAX_LENGTH - 1)}…`
      : message.text;

  const templateObject = {
    object_type: "text",
    text,
    link: { web_url: message.webUrl, mobile_web_url: message.webUrl },
    button_title: message.buttonTitle ?? "자세히 보기",
  };

  const res = await fetch(KAKAO_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ template_object: JSON.stringify(templateObject) }),
  });

  if (!res.ok) {
    console.error(`카카오톡 발송 실패 (HTTP ${res.status}): ${await res.text()}`);
    return false;
  }

  return true;
}

export interface ActiveSubscriber {
  user_id: string;
  regions: string[];
  kakao_connected: boolean;
}

/**
 * 활성 상태이면서 카카오 연결이 돼 있는 구독자에게 메시지를 보낸다.
 * regionCode가 주어지면 subscriber.regions가 비어있거나(전체 지역) regionCode를 포함하는
 * 경우에만 발송 대상으로 삼는다. 토큰 갱신 실패(재연결 필요)가 발생한 구독자는
 * kakao_connected를 false로 내려 다음부터 대상에서 제외되게 한다.
 * 반환값: 발송 시도한 구독자 수, 성공 수.
 */
export async function sendToSubscribers(
  supabase: SupabaseClient,
  subscribers: ActiveSubscriber[],
  restApiKey: string,
  clientSecret: string | undefined,
  buildMessage: (subscriber: ActiveSubscriber) => KakaoMessage | null,
): Promise<{ attempted: number; sent: number }> {
  let attempted = 0;
  let sent = 0;

  for (const subscriber of subscribers) {
    const message = buildMessage(subscriber);
    if (!message) continue;

    const { data: tokenRow, error: tokenFetchError } = await supabase
      .from("kakao_tokens")
      .select("user_id, access_token, refresh_token, expires_at")
      .eq("user_id", subscriber.user_id)
      .maybeSingle();

    if (tokenFetchError || !tokenRow) continue;

    attempted += 1;
    const accessToken = await getValidKakaoAccessToken(supabase, tokenRow, restApiKey, clientSecret);

    if (!accessToken) {
      await supabase.from("subscribers").update({ kakao_connected: false }).eq("user_id", subscriber.user_id);
      continue;
    }

    const ok = await sendKakaoMemo(accessToken, message);
    if (ok) sent += 1;
  }

  return { attempted, sent };
}
