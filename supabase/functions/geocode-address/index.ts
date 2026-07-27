// Supabase Edge Function: 주소/지명/지역명 검색어를 네이버 지역 검색(오픈API)으로 지오코딩해서
// 지역(+시군구)과 좌표를 돌려준다. 지역 정보 페이지(/places)에서 지도 클릭 대신 이 검색으로
// 지역을 찾는다. nearby-info가 이미 쓰는 것과 같은 네이버 지역 검색 API/자격증명을 재사용한다
// (카카오 로컬 API는 이 프로젝트 앱에서 "카카오맵" 서비스가 비활성화돼 있어 대신 네이버로 감).
//
// places 테이블 자체 주소를 부분 일치(ILIKE)로 찾는 방식은 우리가 지역당 카테고리별
// 최대 100건만 동기화해둔 표본이라 커버리지가 좁아(예: 특정 도로명이 표본에 없으면
// 매칭 실패) 실제 임의의 주소 검색에는 부적합했다.
//
// 같은 지명이 여러 지역에 있을 수 있어(예: "송정" - 부산 송정, 구미 송정동 등) 검색
// 결과를 하나로 단정하지 않고, 네이버 지역검색 결과(최대 5개, API 자체 한도)를 지역+
// 시군구 기준으로 중복 제거해 후보 목록으로 돌려준다. 프론트에서 후보가 여럿이면
// 드롭다운으로 고르게 하고, 하나뿐이면 바로 적용한다.
//
// 요청: POST { query: string }
// 응답: { candidates: Array<{ regionCode, sigungu, latitude, longitude, matchedName, address }> } | { error }
//
// 네이버 지역검색은 인기도/관련도 순으로 최대 5개만 주기 때문에, 같은 지명이 여러
// 지역에 있어도 유명한 한 지역(예: "송정" -> 부산 송정해수욕장)만 상위에 몰릴 수 있다.
// 이를 보완하려고 우리 자체 places 테이블(sigungu/주소에 검색어가 들어간 것)도 함께
// 찾아서 후보에 합친다 - 이미 4천 건 넘게 동기화해둔 실제 지역 데이터라 네이버 결과에
// 없는 지역을 추가로 드러내줄 수 있다.
//
// 필요한 시크릿: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET (nearby-info와 동일),
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (런타임 자동 주입)
// 배포: supabase functions deploy geocode-address

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const NAVER_LOCAL_SEARCH_URL = "https://openapi.naver.com/v1/search/local.json";
const MAX_CANDIDATES = 8;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** 이 프로젝트 내부 지역 코드 <-> 정식 지역명(네이버 응답 주소 텍스트에 그대로 등장). */
const REGION_NAMES: [string, string][] = [
  ["seoul", "서울특별시"],
  ["incheon", "인천광역시"],
  ["gyeonggi", "경기도"],
  ["gangwon", "강원특별자치도"],
  ["gangwon", "강원도"], // 개편 이전 표기 호환
  ["chungbuk", "충청북도"],
  ["sejong", "세종특별자치시"],
  ["chungnam", "충청남도"],
  ["daejeon", "대전광역시"],
  ["jeonbuk", "전북특별자치도"],
  ["jeonbuk", "전라북도"], // 개편 이전 표기 호환
  ["gyeongbuk", "경상북도"],
  ["daegu", "대구광역시"],
  ["gwangju", "광주광역시"],
  ["jeonnam", "전라남도"],
  ["gyeongnam", "경상남도"],
  ["ulsan", "울산광역시"],
  ["busan", "부산광역시"],
  ["jeju", "제주특별자치도"],
];

function resolveRegionCode(addressText: string): string | null {
  for (const [code, name] of REGION_NAMES) {
    if (addressText.startsWith(name)) return code;
  }
  return null;
}

/** 지역명 다음 토큰이 시/군/구로 끝나면 시/군/구 이름으로 쓴다(sync-festivals와 동일 규칙). */
function extractSigungu(addressText: string): string | null {
  const candidate = addressText.trim().split(/\s+/)[1];
  return candidate && /(시|군|구)$/.test(candidate) ? candidate : null;
}

function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

interface NaverLocalItem {
  title: string;
  address: string;
  roadAddress: string;
  mapx: string;
  mapy: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const naverClientId = Deno.env.get("NAVER_CLIENT_ID");
    const naverClientSecret = Deno.env.get("NAVER_CLIENT_SECRET");
    if (!naverClientId || !naverClientSecret) {
      return new Response(
        JSON.stringify({ error: "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 시크릿이 설정되지 않았습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => null);
    const query: string = typeof body?.query === "string" ? body.query.trim() : "";
    if (!query) {
      return new Response(
        JSON.stringify({ error: "query가 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(NAVER_LOCAL_SEARCH_URL);
    url.searchParams.set("query", query);
    url.searchParams.set("display", "5"); // 네이버 지역검색 자체 한도(최대 5)

    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": naverClientId,
        "X-Naver-Client-Secret": naverClientSecret,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`네이버 지역 검색 실패: HTTP ${res.status} ${text}`);
    }
    const json = await res.json();
    const items: NaverLocalItem[] = json.items ?? [];

    const seen = new Set<string>();
    const candidates: {
      regionCode: string;
      sigungu: string | null;
      latitude: number;
      longitude: number;
      matchedName: string;
      address: string;
    }[] = [];

    for (const item of items) {
      const addressText = (item.roadAddress || item.address).trim();
      const regionCode = resolveRegionCode(addressText);
      if (!regionCode) continue;

      const sigungu = extractSigungu(addressText);
      const dedupeKey = `${regionCode}|${sigungu ?? ""}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      // 네이버 지역검색은 mapx/mapy를 WGS84 좌표 * 10^7 정수로 준다(nearby-info와 동일 규칙).
      candidates.push({
        regionCode,
        sigungu,
        latitude: Number(item.mapy) / 10000000,
        longitude: Number(item.mapx) / 10000000,
        matchedName: stripHtmlTags(item.title),
        address: addressText,
      });
    }

    // 네이버 결과에 없는 지역을 우리 자체 places 데이터로 보완한다.
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceRoleKey && candidates.length < MAX_CANDIDATES) {
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data: placeRows } = await supabase
        .from("places")
        .select("name, region_code, sigungu, address, latitude, longitude")
        .or(`sigungu.ilike.%${query}%,address.ilike.%${query}%`)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .limit(20);

      for (const row of placeRows ?? []) {
        if (candidates.length >= MAX_CANDIDATES) break;
        const dedupeKey = `${row.region_code}|${row.sigungu ?? ""}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        candidates.push({
          regionCode: row.region_code,
          sigungu: row.sigungu,
          latitude: row.latitude,
          longitude: row.longitude,
          matchedName: row.name,
          address: row.address,
        });
      }
    }

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ error: "일치하는 위치를 찾지 못했습니다." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ candidates }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
