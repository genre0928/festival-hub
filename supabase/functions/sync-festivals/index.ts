// Supabase Edge Function: 한국관광공사 TourAPI(searchFestival2)에서 축제 정보를 가져와
// festivals 테이블에 upsert 한다. (source='tourapi', external_id=contentid 기준 idempotent)
//
// 필요한 시크릿:
//   TOUR_API_KEY           data.go.kr에서 발급받은 서비스키(인코딩된 값 그대로)
//   SUPABASE_URL            Edge Function 런타임이 자동 주입 (수동 설정 불필요)
//   SUPABASE_SERVICE_ROLE_KEY  Edge Function 런타임이 자동 주입 (수동 설정 불필요)
//
// 배포: supabase functions deploy sync-festivals
// 시크릿 등록: supabase secrets set TOUR_API_KEY="<발급받은 인코딩 키>"
// 수동 실행: supabase functions invoke sync-festivals

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOUR_API_BASE = "https://apis.data.go.kr/B551011/KorService2/searchFestival2";
const MAX_PAGES = 10;
const ROWS_PER_PAGE = 100;

/** TourAPI 지역코드 -> 이 프로젝트의 내부 지역 코드 */
const AREA_CODE_MAP: Record<string, string> = {
  "1": "seoul",
  "2": "incheon",
  "3": "daejeon",
  "4": "daegu",
  "5": "gwangju",
  "6": "busan",
  "7": "ulsan",
  "8": "sejong",
  "31": "gyeonggi",
  "32": "gangwon",
  "33": "chungbuk",
  "34": "chungnam",
  "35": "gyeongbuk",
  "36": "gyeongnam",
  "37": "jeonbuk",
  "38": "jeonnam",
  "39": "jeju",
};

/** areacode가 비어있는 응답이 많아 주소 텍스트로도 보조 매칭 */
const ADDRESS_KEYWORD_MAP: [string, string][] = [
  ["서울", "seoul"],
  ["인천", "incheon"],
  ["세종", "sejong"],
  ["대전", "daejeon"],
  ["대구", "daegu"],
  ["광주", "gwangju"],
  ["부산", "busan"],
  ["울산", "ulsan"],
  ["경기", "gyeonggi"],
  ["강원", "gangwon"],
  ["충청북도", "chungbuk"],
  ["충북", "chungbuk"],
  ["충청남도", "chungnam"],
  ["충남", "chungnam"],
  ["경상북도", "gyeongbuk"],
  ["경북", "gyeongbuk"],
  ["경상남도", "gyeongnam"],
  ["경남", "gyeongnam"],
  ["전라북도", "jeonbuk"],
  ["전북", "jeonbuk"],
  ["전라남도", "jeonnam"],
  ["전남", "jeonnam"],
  ["제주", "jeju"],
];

/** cat1/cat2/cat3가 비어있는 경우가 많아 제목 키워드로 대략적인 카테고리를 추정 */
const CATEGORY_KEYWORDS: [string[], string][] = [
  [["불꽃", "폭죽"], "불꽃"],
  [["음악", "뮤직", "재즈", "페스티벌", "락", "콘서트"], "음악"],
  [["음식", "먹거리", "맛", "미식", "요리", "김치", "막걸리"], "음식"],
  [["전통", "민속", "역사", "탈춤", "문화재"], "전통"],
  [["꽃", "생태", "자연", "단풍", "나비", "갯벌", "숲"], "자연"],
  [["미술", "예술", "공연", "전시", "연극", "영화"], "예술"],
];

interface TourApiItem {
  contentid: string;
  title: string;
  addr1?: string;
  addr2?: string;
  areacode?: string;
  eventstartdate?: string;
  eventenddate?: string;
  mapx?: string;
  mapy?: string;
  firstimage?: string;
}

function resolveRegionCode(areacode: string | undefined, addr1: string | undefined): string | null {
  if (areacode && AREA_CODE_MAP[areacode]) return AREA_CODE_MAP[areacode];
  if (addr1) {
    for (const [keyword, code] of ADDRESS_KEYWORD_MAP) {
      if (addr1.includes(keyword)) return code;
    }
  }
  return null;
}

function guessCategory(title: string): string {
  for (const [keywords, category] of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => title.includes(k))) return category;
  }
  return "기타";
}

function formatDate(yyyymmdd: string | undefined, fallback: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return fallback;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function toYyyymmdd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

async function fetchFestivalPage(serviceKey: string, pageNo: number, eventStartDate: string, eventEndDate: string) {
  const url =
    `${TOUR_API_BASE}?serviceKey=${serviceKey}` +
    `&MobileOS=ETC&MobileApp=festivalhub&_type=json` +
    `&numOfRows=${ROWS_PER_PAGE}&pageNo=${pageNo}` +
    `&eventStartDate=${eventStartDate}&eventEndDate=${eventEndDate}` +
    `&arrange=A`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TourAPI 요청 실패: HTTP ${res.status}`);
  }
  const json = await res.json();
  const header = json?.response?.header;
  if (header?.resultCode !== "0000") {
    throw new Error(`TourAPI 오류 응답: ${header?.resultCode} ${header?.resultMsg}`);
  }

  const body = json?.response?.body;
  const rawItems = body?.items?.item;
  const items: TourApiItem[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  const totalCount: number = body?.totalCount ?? 0;

  return { items, totalCount };
}

Deno.serve(async (req) => {
  try {
    const tourApiKey = Deno.env.get("TOUR_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!tourApiKey || !supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "TOUR_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 시크릿이 설정되지 않았습니다." }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date();
    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - 90);
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + 365);

    const eventStartDate = toYyyymmdd(windowStart);
    const eventEndDate = toYyyymmdd(windowEnd);

    let pageNo = 1;
    let totalCount = Infinity;
    let fetched = 0;
    let skippedNoRegion = 0;
    const rows: Record<string, unknown>[] = [];

    while (pageNo <= MAX_PAGES && (pageNo - 1) * ROWS_PER_PAGE < totalCount) {
      const page = await fetchFestivalPage(tourApiKey, pageNo, eventStartDate, eventEndDate);
      totalCount = page.totalCount;
      fetched += page.items.length;

      for (const item of page.items) {
        const regionCode = resolveRegionCode(item.areacode, item.addr1);
        if (!regionCode) {
          skippedNoRegion += 1;
          continue;
        }

        const startDate = formatDate(item.eventstartdate, eventStartDate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"));
        const endDate = formatDate(item.eventenddate, startDate);

        rows.push({
          name: item.title,
          description: "",
          region_code: regionCode,
          address: [item.addr1, item.addr2].filter(Boolean).join(" "),
          start_date: startDate,
          end_date: endDate < startDate ? startDate : endDate,
          category: guessCategory(item.title ?? ""),
          tags: [],
          image_url: item.firstimage || null,
          latitude: item.mapy ? Number(item.mapy) : null,
          longitude: item.mapx ? Number(item.mapx) : null,
          external_id: item.contentid,
          source: "tourapi",
        });
      }

      pageNo += 1;
    }

    let upserted = 0;
    const batchSize = 200;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from("festivals").upsert(batch, { onConflict: "source,external_id" });
      if (error) throw new Error(`Supabase upsert 실패: ${error.message}`);
      upserted += batch.length;
    }

    return new Response(
      JSON.stringify({ totalCount, fetched, upserted, skippedNoRegion }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
