// Supabase Edge Function: 주기(weekly/monthly) 정기 축제 다이제스트를 관심지역이 일치하는
// 활성 구독자에게 카카오톡("나에게 보내기")으로 보낸다. monthly는 "이달의 축제정보"에 해당.
// weekly는 앞으로 7일 이내에 걸치는 축제, monthly는 이번 달에 걸치는 축제를 대상으로 한다.
//
// 요청 본문으로 어떤 주기를 돌릴지 받는다: { "frequency": "weekly" | "monthly" }
// pg_cron에서 주기별로 서로 다른 스케줄(예: 매주 월요일 / 매월 1일)로 각각 다른 본문을 보내
// 이 함수 하나를 호출하도록 구성한다 (README 참고).
//
// 필요한 시크릿: send-new-festival-alerts와 동일
//   (KAKAO_REST_API_KEY, KAKAO_CLIENT_SECRET(선택), SITE_URL(선택),
//    SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY는 런타임 자동 주입)
//
// 배포: supabase functions deploy send-digest
// 수동 실행: supabase functions invoke send-digest --body '{"frequency":"weekly"}'

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendToSubscribers, type ActiveSubscriber, type KakaoMessage } from "../_shared/kakao.ts";

const DEFAULT_SITE_URL = "https://festival-hub-iota.vercel.app";
const MAX_LISTED_FESTIVALS = 5;
const WEEKLY_WINDOW_DAYS = 7;

type Frequency = "weekly" | "monthly";

interface DigestFestivalRow {
  id: string;
  name: string;
  region_code: string;
  start_date: string;
  end_date: string;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** frequency에 맞는 [윈도우 시작, 윈도우 끝] 날짜(YYYY-MM-DD)를 계산한다. */
function resolveWindow(frequency: Frequency, today: Date): { from: string; to: string } {
  if (frequency === "weekly") {
    const to = new Date(today);
    to.setDate(to.getDate() + WEEKLY_WINDOW_DAYS);
    return { from: toIsoDate(today), to: toIsoDate(to) };
  }

  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function buildDigestMessage(
  frequency: Frequency,
  festivals: DigestFestivalRow[],
  regionNames: Map<string, string>,
  siteUrl: string,
): KakaoMessage | null {
  if (festivals.length === 0) return null;

  const heading = frequency === "weekly" ? "이번 주 축제 소식이에요!" : "이달의 축제 소식이에요!";
  const lines = festivals
    .slice(0, MAX_LISTED_FESTIVALS)
    .map((f) => `- ${f.name} (${regionNames.get(f.region_code) ?? f.region_code})`);
  const remaining = festivals.length - MAX_LISTED_FESTIVALS;
  if (remaining > 0) lines.push(`외 ${remaining}건`);

  return {
    text: `${heading}\n\n${lines.join("\n")}`,
    webUrl: siteUrl,
    buttonTitle: "축제 허브에서 보기",
  };
}

Deno.serve(async (req) => {
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

    let frequency: Frequency;
    try {
      const body = await req.json();
      frequency = body?.frequency === "monthly" ? "monthly" : body?.frequency === "weekly" ? "weekly" : null;
    } catch {
      frequency = null;
    }
    if (!frequency) {
      return new Response(
        JSON.stringify({ error: "요청 본문에 frequency(\"weekly\" | \"monthly\")가 필요합니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { from, to } = resolveWindow(frequency, new Date());

    // 대상 기간과 겹치는 축제: start_date <= 윈도우 끝 AND end_date >= 윈도우 시작
    const { data: festivalRows, error: festivalError } = await supabase
      .from("festivals")
      .select("id, name, region_code, start_date, end_date")
      .lte("start_date", to)
      .gte("end_date", from)
      .order("start_date", { ascending: true });
    if (festivalError) throw new Error(`축제 조회 실패: ${festivalError.message}`);

    const festivals = (festivalRows ?? []) as DigestFestivalRow[];

    const { data: regionRows, error: regionError } = await supabase.from("regions").select("code, name");
    if (regionError) throw new Error(`지역 조회 실패: ${regionError.message}`);
    const regionNames = new Map((regionRows ?? []).map((r) => [r.code, r.name]));

    const { data: subscriberRows, error: subscriberError } = await supabase
      .from("subscribers")
      .select("user_id, regions, kakao_connected")
      .eq("is_active", true)
      .eq("kakao_connected", true)
      .eq("frequency", frequency);
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
            ? festivals
            : festivals.filter((f) => subscriber.regions.includes(f.region_code));
        return buildDigestMessage(frequency, relevant, regionNames, siteUrl);
      },
    );

    return new Response(
      JSON.stringify({ frequency, windowFrom: from, windowTo: to, festivalCount: festivals.length, subscribersAttempted: attempted, subscribersSent: sent }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
