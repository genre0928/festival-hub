// Supabase Edge Function: pending_new_festival_notifications 뷰(신규 감지된, 아직 알림을
// 보내지 않은 축제)를 읽어 관심지역이 일치하는 활성 구독자에게 카카오톡("나에게 보내기")으로
// 알림을 보낸다. sync-festivals가 신규 축제를 감지해 festival_new_detections에 기록해두면,
// 이 함수가 주기적으로(pg_cron) 실행되며 발송을 처리한다.
//
// 필요한 시크릿:
//   KAKAO_REST_API_KEY        카카오 디벨로퍼스 앱의 REST API 키 (토큰 갱신 client_id)
//   KAKAO_CLIENT_SECRET        (선택) 카카오 디벨로퍼스에서 Client Secret 사용 설정한 경우
//   SITE_URL                   (선택) 알림 메시지에 넣을 링크. 미설정 시 기본 배포 주소 사용
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  Edge Function 런타임이 자동 주입
//
// 배포: supabase functions deploy send-new-festival-alerts
// 시크릿 등록: supabase secrets set KAKAO_REST_API_KEY="..." KAKAO_CLIENT_SECRET="..."
// 수동 실행: supabase functions invoke send-new-festival-alerts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendToSubscribers, type ActiveSubscriber, type KakaoMessage } from "../_shared/kakao.ts";

const DEFAULT_SITE_URL = "https://festival-hub-iota.vercel.app";
const MAX_LISTED_FESTIVALS = 5;

interface PendingFestivalRow {
  detection_id: string;
  id: string;
  name: string;
  region_code: string;
}

function buildMessageForSubscriber(
  festivals: PendingFestivalRow[],
  regionNames: Map<string, string>,
  siteUrl: string,
): KakaoMessage | null {
  if (festivals.length === 0) return null;

  const lines = festivals
    .slice(0, MAX_LISTED_FESTIVALS)
    .map((f) => `- ${f.name} (${regionNames.get(f.region_code) ?? f.region_code})`);
  const remaining = festivals.length - MAX_LISTED_FESTIVALS;
  if (remaining > 0) lines.push(`외 ${remaining}건`);

  return {
    text: `새로운 축제 소식이 도착했어요!\n\n${lines.join("\n")}`,
    webUrl: siteUrl,
    buttonTitle: "축제 허브에서 보기",
  };
}

Deno.serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const kakaoRestApiKey = Deno.env.get("KAKAO_REST_API_KEY");
    const kakaoClientSecret = Deno.env.get("KAKAO_CLIENT_SECRET") ?? undefined;
    const siteUrl = Deno.env.get("SITE_URL") ?? DEFAULT_SITE_URL;

    if (!supabaseUrl || !serviceRoleKey || !kakaoRestApiKey) {
      return new Response(
        JSON.stringify({ error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / KAKAO_REST_API_KEY 시크릿이 설정되지 않았습니다." }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: pending, error: pendingError } = await supabase
      .from("pending_new_festival_notifications")
      .select("detection_id, id, name, region_code");
    if (pendingError) throw new Error(`신규 축제 조회 실패: ${pendingError.message}`);

    const pendingFestivals = (pending ?? []) as PendingFestivalRow[];
    if (pendingFestivals.length === 0) {
      return new Response(
        JSON.stringify({ pendingCount: 0, subscribersAttempted: 0, subscribersSent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const { data: regionRows, error: regionError } = await supabase.from("regions").select("code, name");
    if (regionError) throw new Error(`지역 조회 실패: ${regionError.message}`);
    const regionNames = new Map((regionRows ?? []).map((r) => [r.code, r.name]));

    const { data: subscriberRows, error: subscriberError } = await supabase
      .from("subscribers")
      .select("user_id, regions, kakao_connected")
      .eq("is_active", true)
      .eq("kakao_connected", true);
    if (subscriberError) throw new Error(`구독자 조회 실패: ${subscriberError.message}`);

    const subscribers = (subscriberRows ?? []) as ActiveSubscriber[];

    const { attempted, sent } = await sendToSubscribers(
      supabase,
      subscribers,
      kakaoRestApiKey,
      kakaoClientSecret,
      (subscriber) => {
        const relevant =
          subscriber.regions.length === 0
            ? pendingFestivals
            : pendingFestivals.filter((f) => subscriber.regions.includes(f.region_code));
        return buildMessageForSubscriber(relevant, regionNames, siteUrl);
      },
    );

    // 이번 배치에서 현재 활성 구독자 전원을 대상으로 처리를 시도했으므로,
    // 처리한 감지 건들은 notified_at을 채워 다음 배치에서 다시 대상이 되지 않게 한다.
    const detectionIds = pendingFestivals.map((f) => f.detection_id);
    const { error: markError } = await supabase
      .from("festival_new_detections")
      .update({ notified_at: new Date().toISOString() })
      .in("id", detectionIds);
    if (markError) throw new Error(`알림 완료 표시 실패: ${markError.message}`);

    return new Response(
      JSON.stringify({ pendingCount: pendingFestivals.length, subscribersAttempted: attempted, subscribersSent: sent }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
