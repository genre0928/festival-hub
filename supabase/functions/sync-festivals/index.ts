// Supabase Edge Function: 한국관광공사 TourAPI(searchFestival2)에서 축제 정보를 가져와
// festivals 테이블에 upsert 한다. (source='tourapi', external_id=contentid 기준 idempotent)
// 이전에 없던 external_id가 새로 들어오면 festival_new_detections에 기록해
// "신규 축제 카카오톡 알림"을 위한 발송 대상 트래킹까지 처리한다 (발송 자체는 별도 구현 예정).
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

/**
 * 법정동 시도코드(lDongRegnCd, 행정안전부 표준) -> 이 프로젝트의 내부 지역 코드.
 * 실제 응답 표본 확인 결과 areacode/cat1~3는 항상 비어있고 lDongRegnCd는 100% 채워져 있어
 * 이걸 1순위 매칭 키로 쓴다. 세종은 하위 시군구가 없어 5자리 전체 코드("36110")로 오는 경우가 있어
 * 앞 2자리만 잘라서(slice(0,2)) 비교한다.
 * 2023~2024년 행정구역 개편으로 강원(42->51), 전북(45->52) 코드가 바뀐 것도 반영.
 */
const L_DONG_REGN_MAP: Record<string, string> = {
  "11": "seoul",
  "26": "busan",
  "27": "daegu",
  "28": "incheon",
  "29": "gwangju",
  "30": "daejeon",
  "31": "ulsan",
  "36": "sejong",
  "41": "gyeonggi",
  "42": "gangwon", // 개편 이전 강원도 코드(과거 데이터 호환용)
  "43": "chungbuk",
  "44": "chungnam",
  "45": "jeonbuk", // 개편 이전 전라북도 코드(과거 데이터 호환용)
  "46": "jeonnam",
  "47": "gyeongbuk",
  "48": "gyeongnam",
  "50": "jeju",
  "51": "gangwon", // 강원특별자치도 개편 코드
  "52": "jeonbuk", // 전북특별자치도 개편 코드
};

/** 광주광역시 산하 구 이름(전남/광주 통합코드 "12" 구분용) */
const GWANGJU_GU_NAMES = ["동구", "서구", "남구", "북구", "광산구"];

/** lDongRegnCd가 없거나 매핑에 실패했을 때만 쓰는 보조 매칭 (주소 텍스트 키워드) */
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
  lDongRegnCd?: string;
  eventstartdate?: string;
  eventenddate?: string;
  mapx?: string;
  mapy?: string;
  firstimage?: string;
}

function resolveRegionCode(item: Pick<TourApiItem, "areacode" | "lDongRegnCd" | "addr1">): string | null {
  const { lDongRegnCd, addr1, areacode } = item;

  if (lDongRegnCd) {
    const prefix = lDongRegnCd.slice(0, 2);
    // "12" = TourAPI 표본에서 확인된 전남/광주 통합 placeholder 코드. 주소의 구/시군 이름으로 구분.
    if (prefix === "12" && addr1) {
      const isGwangjuGu = GWANGJU_GU_NAMES.some((gu) => addr1.includes(gu));
      return isGwangjuGu ? "gwangju" : "jeonnam";
    }
    if (L_DONG_REGN_MAP[prefix]) return L_DONG_REGN_MAP[prefix];
  }

  if (addr1) {
    for (const [keyword, code] of ADDRESS_KEYWORD_MAP) {
      if (addr1.includes(keyword)) return code;
    }
  }

  // TourAPI 자체 areacode는 현재 거의 항상 비어있지만, 혹시 채워진 응답을 위한 최후 fallback
  const legacyAreaCodeMap: Record<string, string> = {
    "1": "seoul", "2": "incheon", "3": "daejeon", "4": "daegu", "5": "gwangju",
    "6": "busan", "7": "ulsan", "8": "sejong", "31": "gyeonggi", "32": "gangwon",
    "33": "chungbuk", "34": "chungnam", "35": "gyeongbuk", "36": "gyeongnam",
    "37": "jeonbuk", "38": "jeonnam", "39": "jeju",
  };
  if (areacode && legacyAreaCodeMap[areacode]) return legacyAreaCodeMap[areacode];

  return null;
}

/**
 * addr1의 두번째 토큰(시/도 다음)이 시/군/구로 끝나면 그대로 시/군/구 이름으로 쓴다.
 * 세종처럼 시/군/구 단위 없이 읍/면/동으로 바로 이어지는 주소는 null을 반환한다.
 */
function extractSigungu(addr1: string | undefined): string | null {
  if (!addr1) return null;
  const candidate = addr1.trim().split(/\s+/)[1];
  return candidate && /(시|군|구)$/.test(candidate) ? candidate : null;
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

    // upsert 전에 이미 존재하는 TourAPI 축제의 external_id를 조회해둔다.
    // 여기 없는데 이번에 들어오는 항목 = 신규 축제 -> festival_new_detections에 기록할 대상.
    const { data: existingRows, error: existingError } = await supabase
      .from("festivals")
      .select("external_id")
      .eq("source", "tourapi");
    if (existingError) throw new Error(`기존 축제 조회 실패: ${existingError.message}`);
    const existingExternalIds = new Set((existingRows ?? []).map((r) => r.external_id));

    let pageNo = 1;
    let totalCount = Infinity;
    let fetched = 0;
    let skippedNoRegion = 0;
    const rows: Record<string, unknown>[] = [];
    const newExternalIds: string[] = [];

    while (pageNo <= MAX_PAGES && (pageNo - 1) * ROWS_PER_PAGE < totalCount) {
      const page = await fetchFestivalPage(tourApiKey, pageNo, eventStartDate, eventEndDate);
      totalCount = page.totalCount;
      fetched += page.items.length;

      for (const item of page.items) {
        const regionCode = resolveRegionCode(item);
        if (!regionCode) {
          skippedNoRegion += 1;
          continue;
        }

        const startDate = formatDate(item.eventstartdate, eventStartDate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"));
        const endDate = formatDate(item.eventenddate, startDate);

        if (!existingExternalIds.has(item.contentid)) {
          newExternalIds.push(item.contentid);
        }

        rows.push({
          name: item.title,
          description: "",
          region_code: regionCode,
          sigungu: extractSigungu(item.addr1),
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

    // 신규 축제로 판별된 항목들의 festivals.id를 조회해 festival_new_detections에 기록.
    // (카카오톡 신규 축제 알림 발송 대상 트래킹용 - 발송 로직은 별도 Edge Function에서 처리)
    let newlyDetected = 0;
    for (let i = 0; i < newExternalIds.length; i += batchSize) {
      const batchIds = newExternalIds.slice(i, i + batchSize);
      const { data: insertedRows, error: lookupError } = await supabase
        .from("festivals")
        .select("id")
        .eq("source", "tourapi")
        .in("external_id", batchIds);
      if (lookupError) throw new Error(`신규 축제 id 조회 실패: ${lookupError.message}`);

      const detections = (insertedRows ?? []).map((r) => ({ festival_id: r.id }));
      if (detections.length > 0) {
        const { error: detectionError } = await supabase
          .from("festival_new_detections")
          .insert(detections);
        if (detectionError) throw new Error(`신규 축제 기록 실패: ${detectionError.message}`);
        newlyDetected += detections.length;
      }
    }

    return new Response(
      JSON.stringify({ totalCount, fetched, upserted, skippedNoRegion, newlyDetected }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
