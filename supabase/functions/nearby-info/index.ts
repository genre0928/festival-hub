// Supabase Edge Function: 축제 좌표(mapX/mapY) 기준으로 주변 관광지/음식점/숙박 정보를
// 한국관광공사_무장애 여행 정보_GW API(KorWithService2, locationBasedList2)에서 가져온다.
// 프론트에서 apis.data.go.kr을 직접 호출하면 CORS로 막히고 인증키도 노출되므로
// 이 함수가 서버 쪽에서 대신 호출해준다.
//
// 요청: POST { mapX: number(경도), mapY: number(위도), radius?: number(m, 기본 5000) }
// 응답: { attractions: PlaceItem[], restaurants: PlaceItem[], lodgings: PlaceItem[] }
//
// 필요한 시크릿: TOUR_API_KEY (sync-festivals와 동일한 값 재사용)
// 배포: supabase functions deploy nearby-info

const TOUR_API_BASE = "https://apis.data.go.kr/B551011/KorWithService2/locationBasedList2";
const DEFAULT_RADIUS = 5000;
const ROWS_PER_CATEGORY = 8;

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

async function fetchCategory(
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
