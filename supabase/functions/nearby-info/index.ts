// Supabase Edge Function: 축제 주변 관광지/음식점/숙박 정보를 가져온다.
//
// - 관광지/음식점: 네이버 검색 오픈API(지역 검색, /v1/search/local.json)를 "{지역명} 맛집"
//   / "{지역명} 관광지" 같은 키워드로 검색한다. 위경도 반경 검색이 아니라 키워드 검색이라
//   TourAPI보다 실제 존재하는 음식점/관광지 커버리지가 훨씬 좋다. 다만 지역 검색 API는
//   자체 상세 페이지가 없는 경우가 많아, 각 결과에 네이버로 바로 이동하는 링크를 붙여
//   상세 정보(리뷰/사진 등)는 네이버에서 보게 한다.
// - 숙박: 여전히 한국관광공사_무장애 여행 정보_GW API(KorWithService2, locationBasedList2)의
//   좌표 기반 반경 검색을 쓴다(여기어때/야놀자는 공개 API가 없어 대안이 없음).
//
// 요청: POST { mapX: number(경도), mapY: number(위도), regionQuery: string(예: "충청남도 보령시") }
// 응답: { attractions: CategoryResult, restaurants: CategoryResult, lodgings: CategoryResult }
//
// 필요한 시크릿: TOUR_API_KEY, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
// 배포: supabase functions deploy nearby-info

const TOUR_API_BASE = "https://apis.data.go.kr/B551011/KorWithService2/locationBasedList2";
const NAVER_LOCAL_SEARCH_URL = "https://openapi.naver.com/v1/search/local.json";
const DEFAULT_RADIUS = 5000;
const ROWS_PER_CATEGORY = 12;
/** 결과가 이 개수 미만이면 다음 반경으로 재시도 (숙박에만 적용) */
const MIN_RESULTS_BEFORE_EXPAND = 4;
/** 기본 반경에서 결과가 부족할 때 순서대로 넓혀가며 재시도할 반경(m) (숙박에만 적용) */
const EXPAND_RADII = [10000, 20000];
/** 네이버 지역검색은 display 최대 5까지만 허용됨 */
const NAVER_DISPLAY_COUNT = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PlaceItem {
  contentId: string;
  title: string;
  address: string;
  imageUrl: string | null;
  tel: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
  /** 네이버 지역검색 결과에만 있음 - "네이버에서 보기" 링크 */
  link: string | null;
}

interface CategoryResult {
  places: PlaceItem[];
  /** 실제로 결과를 찾는 데 쓰인 반경(m). 기본 반경보다 크면 프론트에서 안내 문구로 쓸 수 있음.
   * 네이버 지역검색(관광지/음식점)은 반경 검색이 아니라 항상 0. */
  radiusMeters: number;
}

// ---- 숙박: TourAPI(무장애 여행 정보) 좌표 기반 반경 검색 ----

interface TourApiRawItem {
  contentid: string;
  title: string;
  addr1?: string;
  addr2?: string;
  firstimage?: string;
  tel?: string;
  mapx?: string;
  mapy?: string;
  dist?: string;
}

function mapTourApiItem(item: TourApiRawItem): PlaceItem {
  return {
    contentId: item.contentid,
    title: item.title,
    address: [item.addr1, item.addr2].filter(Boolean).join(" "),
    imageUrl: item.firstimage || null,
    tel: item.tel || null,
    latitude: item.mapy ? Number(item.mapy) : null,
    longitude: item.mapx ? Number(item.mapx) : null,
    distanceMeters: item.dist ? Math.round(Number(item.dist)) : null,
    link: null,
  };
}

async function fetchLodgingsAtRadius(serviceKey: string, mapX: number, mapY: number, radius: number): Promise<PlaceItem[]> {
  const url =
    `${TOUR_API_BASE}?serviceKey=${serviceKey}` +
    `&MobileOS=ETC&MobileApp=festivalhub&_type=json` +
    `&mapX=${mapX}&mapY=${mapY}&radius=${radius}` +
    `&contentTypeId=32&numOfRows=${ROWS_PER_CATEGORY}&pageNo=1&arrange=E`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`무장애여행 API 요청 실패: HTTP ${res.status}`);
  const json = await res.json();
  const header = json?.response?.header;
  if (header?.resultCode !== "0000") {
    throw new Error(`무장애여행 API 오류: ${header?.resultCode} ${header?.resultMsg}`);
  }

  const raw = json?.response?.body?.items?.item;
  const items: TourApiRawItem[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return items.map(mapTourApiItem);
}

async function fetchLodgings(serviceKey: string, mapX: number, mapY: number): Promise<CategoryResult> {
  let places = await fetchLodgingsAtRadius(serviceKey, mapX, mapY, DEFAULT_RADIUS);
  let radiusMeters = DEFAULT_RADIUS;

  for (const nextRadius of EXPAND_RADII) {
    if (places.length >= MIN_RESULTS_BEFORE_EXPAND) break;
    places = await fetchLodgingsAtRadius(serviceKey, mapX, mapY, nextRadius);
    radiusMeters = nextRadius;
  }

  return { places, radiusMeters };
}

// ---- 관광지/음식점: 네이버 지역 검색(키워드) ----

interface NaverLocalItem {
  title: string;
  link: string;
  category: string;
  telephone: string;
  address: string;
  roadAddress: string;
  mapx: string;
  mapy: string;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** 네이버 검색 결과 title에 섞여오는 <b> 강조 태그와 HTML 엔티티(&amp; 등)를 제거한다. */
function cleanNaverText(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, (match) => HTML_ENTITIES[match]);
}

function mapNaverItem(item: NaverLocalItem, index: number, queryForFallbackLink: string): PlaceItem {
  const title = cleanNaverText(item.title);
  // 네이버 지역검색은 mapx/mapy를 WGS84 좌표 * 10^7 정수로 준다.
  const longitude = item.mapx ? Number(item.mapx) / 10000000 : null;
  const latitude = item.mapy ? Number(item.mapy) / 10000000 : null;
  // item.link는 업체 자체 홈페이지/블로그일 때가 많아 "네이버로 가서 보기"라는 취지와
  // 안 맞는다. 항상 네이버 지도 검색으로 보내서 실제로 네이버에서(리뷰/사진 등) 보게 한다.
  const link = `https://map.naver.com/v5/search/${encodeURIComponent(title || queryForFallbackLink)}`;

  return {
    contentId: `naver-${index}-${title}`,
    title,
    address: item.roadAddress || item.address,
    imageUrl: null,
    tel: item.telephone || null,
    latitude,
    longitude,
    distanceMeters: null,
    link,
  };
}

async function fetchNaverLocal(clientId: string, clientSecret: string, query: string): Promise<PlaceItem[]> {
  const url = new URL(NAVER_LOCAL_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(NAVER_DISPLAY_COUNT));

  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });
  if (!res.ok) {
    throw new Error(`네이버 지역 검색 실패(${query}): HTTP ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const items: NaverLocalItem[] = json.items ?? [];
  return items.map((item, i) => mapNaverItem(item, i, query));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const tourApiKey = Deno.env.get("TOUR_API_KEY");
    const naverClientId = Deno.env.get("NAVER_CLIENT_ID");
    const naverClientSecret = Deno.env.get("NAVER_CLIENT_SECRET");
    if (!tourApiKey || !naverClientId || !naverClientSecret) {
      return new Response(
        JSON.stringify({ error: "TOUR_API_KEY / NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 시크릿이 설정되지 않았습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => null);
    const mapX = Number(body?.mapX);
    const mapY = Number(body?.mapY);
    const regionQuery: string = typeof body?.regionQuery === "string" ? body.regionQuery.trim() : "";
    if (!Number.isFinite(mapX) || !Number.isFinite(mapY)) {
      return new Response(
        JSON.stringify({ error: "mapX, mapY(숫자)가 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!regionQuery) {
      return new Response(
        JSON.stringify({ error: "regionQuery(예: \"충청남도 보령시\")가 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const [attractionPlaces, restaurantPlaces, lodgings] = await Promise.all([
      fetchNaverLocal(naverClientId, naverClientSecret, `${regionQuery} 관광지`),
      fetchNaverLocal(naverClientId, naverClientSecret, `${regionQuery} 맛집`),
      fetchLodgings(tourApiKey, mapX, mapY),
    ]);

    const attractions: CategoryResult = { places: attractionPlaces, radiusMeters: 0 };
    const restaurants: CategoryResult = { places: restaurantPlaces, radiusMeters: 0 };

    return new Response(
      JSON.stringify({ attractions, restaurants, lodgings }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
