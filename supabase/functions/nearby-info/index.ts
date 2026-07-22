// Supabase Edge Function: 축제 좌표(mapX/mapY) 기준으로 주변 관광지/음식점/숙박 정보를
// 한국관광공사_무장애 여행 정보_GW API(KorWithService2, locationBasedList2)에서 가져온다.
// 프론트에서 apis.data.go.kr을 직접 호출하면 CORS로 막히고 인증키도 노출되므로
// 이 함수가 서버 쪽에서 대신 호출해준다.
//
// 여기어때/야놀자(NOL) 같은 국내 OTA는 공개 API가 없고(제휴사만 대상인 비공개 연동)
// 개인/소규모 개발자가 붙일 방법이 없어서, TourAPI 하나로 결과가 적을 때 반경을
// 단계적으로 넓혀 재시도하는 방식으로 커버리지를 최대한 확보한다.
//
// 요청: POST { mapX: number(경도), mapY: number(위도), radius?: number(m, 기본 5000) }
// 응답: { attractions: CategoryResult, restaurants: CategoryResult, lodgings: CategoryResult }
//
// 필요한 시크릿: TOUR_API_KEY (sync-festivals와 동일한 값 재사용)
// 배포: supabase functions deploy nearby-info

const TOUR_API_BASE = "https://apis.data.go.kr/B551011/KorWithService2/locationBasedList2";
const DEFAULT_RADIUS = 5000;
const ROWS_PER_CATEGORY = 12;
/** 결과가 이 개수 미만이면 다음 반경으로 재시도 */
const MIN_RESULTS_BEFORE_EXPAND = 4;
/** 기본 반경에서 결과가 부족할 때 순서대로 넓혀가며 재시도할 반경(m) */
const EXPAND_RADII = [10000, 20000];

const CONTENT_TYPE_ID = {
  attractions: "12", // 관광지
  restaurants: "39", // 음식점
  lodgings: "32", // 숙박
} as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RawItem {
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

interface PlaceItem {
  contentId: string;
  title: string;
  address: string;
  imageUrl: string | null;
  tel: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
}

function mapItem(item: RawItem): PlaceItem {
  return {
    contentId: item.contentid,
    title: item.title,
    address: [item.addr1, item.addr2].filter(Boolean).join(" "),
    imageUrl: item.firstimage || null,
    tel: item.tel || null,
    latitude: item.mapy ? Number(item.mapy) : null,
    longitude: item.mapx ? Number(item.mapx) : null,
    distanceMeters: item.dist ? Math.round(Number(item.dist)) : null,
  };
}

interface CategoryResult {
  places: PlaceItem[];
  /** 실제로 결과를 찾는 데 쓰인 반경(m). 기본 반경보다 크면 프론트에서 안내 문구로 쓸 수 있음 */
  radiusMeters: number;
}

async function fetchAtRadius(
  serviceKey: string,
  mapX: number,
  mapY: number,
  radius: number,
  contentTypeId: string,
): Promise<PlaceItem[]> {
  const url =
    `${TOUR_API_BASE}?serviceKey=${serviceKey}` +
    `&MobileOS=ETC&MobileApp=festivalhub&_type=json` +
    `&mapX=${mapX}&mapY=${mapY}&radius=${radius}` +
    `&contentTypeId=${contentTypeId}&numOfRows=${ROWS_PER_CATEGORY}&pageNo=1&arrange=E`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`무장애여행 API 요청 실패: HTTP ${res.status}`);
  }
  const json = await res.json();
  const header = json?.response?.header;
  if (header?.resultCode !== "0000") {
    throw new Error(`무장애여행 API 오류: ${header?.resultCode} ${header?.resultMsg}`);
  }

  const raw = json?.response?.body?.items?.item;
  const items: RawItem[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return items.map(mapItem);
}

/** 기본 반경에서 결과가 부족하면 EXPAND_RADII 순서대로 넓혀가며 재시도 */
async function fetchCategory(
  serviceKey: string,
  mapX: number,
  mapY: number,
  baseRadius: number,
  contentTypeId: string,
): Promise<CategoryResult> {
  let places = await fetchAtRadius(serviceKey, mapX, mapY, baseRadius, contentTypeId);
  let radiusMeters = baseRadius;

  for (const nextRadius of EXPAND_RADII) {
    if (places.length >= MIN_RESULTS_BEFORE_EXPAND) break;
    places = await fetchAtRadius(serviceKey, mapX, mapY, nextRadius, contentTypeId);
    radiusMeters = nextRadius;
  }

  return { places, radiusMeters };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const tourApiKey = Deno.env.get("TOUR_API_KEY");
    if (!tourApiKey) {
      return new Response(
        JSON.stringify({ error: "TOUR_API_KEY 시크릿이 설정되지 않았습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => null);
    const mapX = Number(body?.mapX);
    const mapY = Number(body?.mapY);
    if (!Number.isFinite(mapX) || !Number.isFinite(mapY)) {
      return new Response(
        JSON.stringify({ error: "mapX, mapY(숫자)가 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const radius = Number(body?.radius) > 0 ? Number(body.radius) : DEFAULT_RADIUS;

    const [attractions, restaurants, lodgings] = await Promise.all([
      fetchCategory(tourApiKey, mapX, mapY, radius, CONTENT_TYPE_ID.attractions),
      fetchCategory(tourApiKey, mapX, mapY, radius, CONTENT_TYPE_ID.restaurants),
      fetchCategory(tourApiKey, mapX, mapY, radius, CONTENT_TYPE_ID.lodgings),
    ]);

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
