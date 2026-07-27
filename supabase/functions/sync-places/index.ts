// Supabase Edge Function: 한국관광공사 TourAPI(areaBasedList2)에서 지역별 관광지/숙소/
// 음식점 정보를 가져와 places 테이블에 upsert한다. sync-festivals와 같은 idempotent
// 패턴(source='tourapi', external_id=contentid 기준)을 쓴다.
//
// searchFestival2(축제/행사 전용)와 달리 areaBasedList2는 지역(areaCode) + 콘텐츠타입
// (contentTypeId)으로 그 지역의 일반 관광정보를 그대로 훑어볼 수 있는 엔드포인트라
// "지역 정보 페이지"(관광지/숙소/음식점 목록)에 적합하다. 관광지/음식점을 네이버 지역
// 검색으로 가져오는 nearby-info와 달리, 여기서는 한 페이지에 최대 100건씩 여러 페이지를
// 그대로 받아 "지역 전체 목록"을 구성한다(네이버 지역검색은 건당 최대 5개만 줘서 부적합).
//
// 필요한 시크릿: TOUR_API_KEY, SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY(자동 주입)
// 배포: supabase functions deploy sync-places
// 수동 실행: supabase functions invoke sync-places
// 수동 실행(페이지 수 조절): supabase functions invoke sync-places --body '{"maxPagesPerCombo":2}'

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TOUR_AREA_CODE } from "../_shared/tour-area-codes.ts";

const TOUR_API_BASE = "https://apis.data.go.kr/B551011/KorService2/areaBasedList2";
const ROWS_PER_PAGE = 100;
/** 실행당 지역x카테고리 조합마다 이 페이지 수까지만(기본 1페이지=최대 100건/조합). */
const DEFAULT_MAX_PAGES_PER_COMBO = 1;

type PlaceCategory = "attraction" | "lodging" | "restaurant";

/** TourAPI contentTypeId: 12=관광지, 32=숙박, 39=음식점 */
const CONTENT_TYPE_ID: Record<PlaceCategory, string> = {
  attraction: "12",
  lodging: "32",
  restaurant: "39",
};

interface TourApiPlaceItem {
  contentid: string;
  title: string;
  addr1?: string;
  addr2?: string;
  tel?: string;
  firstimage?: string;
  mapx?: string;
  mapy?: string;
}

/** addr1의 두번째 토큰이 시/군/구로 끝나면 시/군/구 이름으로 쓴다(sync-festivals와 동일 규칙). */
function extractSigungu(addr1: string | undefined): string | null {
  if (!addr1) return null;
  const candidate = addr1.trim().split(/\s+/)[1];
  return candidate && /(시|군|구)$/.test(candidate) ? candidate : null;
}

async function fetchPlacePage(
  serviceKey: string,
  areaCode: string,
  contentTypeId: string,
  pageNo: number,
): Promise<{ items: TourApiPlaceItem[]; totalCount: number }> {
  const url =
    `${TOUR_API_BASE}?serviceKey=${serviceKey}` +
    `&MobileOS=ETC&MobileApp=festivalhub&_type=json` +
    `&numOfRows=${ROWS_PER_PAGE}&pageNo=${pageNo}` +
    `&areaCode=${areaCode}&contentTypeId=${contentTypeId}&arrange=A`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`TourAPI 요청 실패: HTTP ${res.status}`);
  const json = await res.json();
  const header = json?.response?.header;
  if (header?.resultCode !== "0000") {
    throw new Error(`TourAPI 오류 응답: ${header?.resultCode} ${header?.resultMsg}`);
  }

  const body = json?.response?.body;
  const rawItems = body?.items?.item;
  const items: TourApiPlaceItem[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
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

    const body = await req.json().catch(() => null);
    const maxPagesPerCombo =
      Number(body?.maxPagesPerCombo) > 0 ? Number(body.maxPagesPerCombo) : DEFAULT_MAX_PAGES_PER_COMBO;

    const rows: Record<string, unknown>[] = [];
    const perCombo: { region: string; category: PlaceCategory; count: number }[] = [];

    for (const [regionCode, areaCode] of Object.entries(TOUR_AREA_CODE)) {
      for (const category of Object.keys(CONTENT_TYPE_ID) as PlaceCategory[]) {
        let comboCount = 0;
        for (let pageNo = 1; pageNo <= maxPagesPerCombo; pageNo++) {
          const { items } = await fetchPlacePage(tourApiKey, areaCode, CONTENT_TYPE_ID[category], pageNo);
          if (items.length === 0) break;

          for (const item of items) {
            if (!item.title || !item.contentid) continue;
            rows.push({
              name: item.title,
              category,
              region_code: regionCode,
              sigungu: extractSigungu(item.addr1),
              address: [item.addr1, item.addr2].filter(Boolean).join(" "),
              tel: item.tel || null,
              image_url: item.firstimage || null,
              latitude: item.mapy ? Number(item.mapy) : null,
              longitude: item.mapx ? Number(item.mapx) : null,
              external_id: item.contentid,
              source: "tourapi",
            });
            comboCount += 1;
          }

          if (items.length < ROWS_PER_PAGE) break; // 마지막 페이지
        }
        perCombo.push({ region: regionCode, category, count: comboCount });
      }
    }

    let upserted = 0;
    const batchSize = 200;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from("places").upsert(batch, { onConflict: "source,external_id" });
      if (error) throw new Error(`Supabase upsert 실패: ${error.message}`);
      upserted += batch.length;
    }

    return new Response(
      JSON.stringify({ fetched: rows.length, upserted, perCombo }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
