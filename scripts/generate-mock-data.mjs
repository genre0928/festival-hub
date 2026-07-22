// TourAPI(searchFestival2)에서 실제 축제 데이터를 받아 app/lib/data/festivals.mock.ts를 생성한다.
// Supabase가 아직 연결되지 않은 상태에서도 실제 데이터로 화면을 확인할 수 있도록,
// supabase/functions/sync-festivals/index.ts와 동일한 매핑 로직(지역/카테고리 추정)을 재사용한다.
//
// 실행: node --env-file=.env scripts/generate-mock-data.mjs

import { writeFile } from "node:fs/promises";

const TOUR_API_KEY = process.env.TOUR_API_KEY;
if (!TOUR_API_KEY) {
  console.error("TOUR_API_KEY가 없습니다. .env에 TOUR_API_KEY=... 를 설정하세요.");
  process.exit(1);
}

const TOUR_API_BASE = "https://apis.data.go.kr/B551011/KorService2/searchFestival2";
const MAX_PAGES = 10;
const ROWS_PER_PAGE = 100;

const L_DONG_REGN_MAP = {
  "11": "seoul", "26": "busan", "27": "daegu", "28": "incheon", "29": "gwangju",
  "30": "daejeon", "31": "ulsan", "36": "sejong", "41": "gyeonggi", "42": "gangwon",
  "43": "chungbuk", "44": "chungnam", "45": "jeonbuk", "46": "jeonnam",
  "47": "gyeongbuk", "48": "gyeongnam", "50": "jeju", "51": "gangwon", "52": "jeonbuk",
};
const GWANGJU_GU_NAMES = ["동구", "서구", "남구", "북구", "광산구"];
const ADDRESS_KEYWORD_MAP = [
  ["서울", "seoul"], ["인천", "incheon"], ["세종", "sejong"], ["대전", "daejeon"],
  ["대구", "daegu"], ["광주", "gwangju"], ["부산", "busan"], ["울산", "ulsan"],
  ["경기", "gyeonggi"], ["강원", "gangwon"], ["충청북도", "chungbuk"], ["충북", "chungbuk"],
  ["충청남도", "chungnam"], ["충남", "chungnam"], ["경상북도", "gyeongbuk"], ["경북", "gyeongbuk"],
  ["경상남도", "gyeongnam"], ["경남", "gyeongnam"], ["전라북도", "jeonbuk"], ["전북", "jeonbuk"],
  ["전라남도", "jeonnam"], ["전남", "jeonnam"], ["제주", "jeju"],
];
const CATEGORY_KEYWORDS = [
  [["불꽃", "폭죽"], "불꽃"],
  [["음악", "뮤직", "재즈", "페스티벌", "락", "콘서트"], "음악"],
  [["음식", "먹거리", "맛", "미식", "요리", "김치", "막걸리"], "음식"],
  [["전통", "민속", "역사", "탈춤", "문화재"], "전통"],
  [["꽃", "생태", "자연", "단풍", "나비", "갯벌", "숲"], "자연"],
  [["미술", "예술", "공연", "전시", "연극", "영화"], "예술"],
];

function resolveRegionCode({ areacode, lDongRegnCd, addr1 }) {
  if (lDongRegnCd) {
    const prefix = lDongRegnCd.slice(0, 2);
    if (prefix === "12" && addr1) {
      return GWANGJU_GU_NAMES.some((gu) => addr1.includes(gu)) ? "gwangju" : "jeonnam";
    }
    if (L_DONG_REGN_MAP[prefix]) return L_DONG_REGN_MAP[prefix];
  }
  if (addr1) {
    for (const [keyword, code] of ADDRESS_KEYWORD_MAP) {
      if (addr1.includes(keyword)) return code;
    }
  }
  const legacy = {
    "1": "seoul", "2": "incheon", "3": "daejeon", "4": "daegu", "5": "gwangju", "6": "busan",
    "7": "ulsan", "8": "sejong", "31": "gyeonggi", "32": "gangwon", "33": "chungbuk",
    "34": "chungnam", "35": "gyeongbuk", "36": "gyeongnam", "37": "jeonbuk", "38": "jeonnam", "39": "jeju",
  };
  if (areacode && legacy[areacode]) return legacy[areacode];
  return null;
}

function guessCategory(title) {
  for (const [keywords, category] of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => title.includes(k))) return category;
  }
  return "기타";
}

function formatDate(yyyymmdd, fallback) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return fallback;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function toYyyymmdd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

const today = new Date();
const windowStart = new Date(today);
windowStart.setDate(windowStart.getDate() - 90);
const windowEnd = new Date(today);
windowEnd.setDate(windowEnd.getDate() + 365);
const eventStartDate = toYyyymmdd(windowStart);
const eventEndDate = toYyyymmdd(windowEnd);
const isoFallbackStart = eventStartDate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");

async function fetchPage(pageNo) {
  const url =
    `${TOUR_API_BASE}?serviceKey=${TOUR_API_KEY}` +
    `&MobileOS=ETC&MobileApp=festivalhub&_type=json` +
    `&numOfRows=${ROWS_PER_PAGE}&pageNo=${pageNo}` +
    `&eventStartDate=${eventStartDate}&eventEndDate=${eventEndDate}&arrange=A`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const header = json?.response?.header;
  if (header?.resultCode !== "0000") throw new Error(`${header?.resultCode} ${header?.resultMsg}`);
  const body = json?.response?.body;
  const raw = body?.items?.item;
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return { items, totalCount: body?.totalCount ?? 0 };
}

console.log(`요청 기간: ${eventStartDate} ~ ${eventEndDate}`);

let pageNo = 1;
let totalCount = Infinity;
const seen = new Set();
const rows = [];
let skippedNoRegion = 0;
let skippedDuplicate = 0;

while (pageNo <= MAX_PAGES && (pageNo - 1) * ROWS_PER_PAGE < totalCount) {
  const page = await fetchPage(pageNo);
  totalCount = page.totalCount;
  console.log(`page ${pageNo}: ${page.items.length}건 (totalCount=${totalCount})`);

  for (const item of page.items) {
    if (seen.has(item.contentid)) {
      skippedDuplicate += 1;
      continue;
    }
    seen.add(item.contentid);

    const regionCode = resolveRegionCode(item);
    if (!regionCode) {
      skippedNoRegion += 1;
      continue;
    }

    const startDate = formatDate(item.eventstartdate, isoFallbackStart);
    const endDate = formatDate(item.eventenddate, startDate);

    rows.push({
      id: `tourapi-${item.contentid}`,
      name: item.title,
      description: "",
      regionCode,
      address: [item.addr1, item.addr2].filter(Boolean).join(" "),
      startDate,
      endDate: endDate < startDate ? startDate : endDate,
      category: guessCategory(item.title ?? ""),
      tags: [],
      ...(item.firstimage ? { imageUrl: item.firstimage } : {}),
    });
  }

  pageNo += 1;
}

rows.sort((a, b) => a.startDate.localeCompare(b.startDate));

console.log(`\n최종 ${rows.length}건 (지역 매핑 실패로 제외: ${skippedNoRegion}, 중복 제외: ${skippedDuplicate})`);

const header = `// 한국관광공사 TourAPI(searchFestival2)로 생성된 실제 축제 데이터.
// Supabase가 연결되지 않았을 때 화면에 표시되는 데이터로, 아래 명령으로 다시 생성할 수 있다:
//   node --env-file=.env scripts/generate-mock-data.mjs
// 생성 시각: ${new Date().toISOString()}

export type FestivalCategory =
  | "전통"
  | "음악"
  | "음식"
  | "자연"
  | "불꽃"
  | "예술"
  | "기타";

export interface Festival {
  id: string;
  name: string;
  description: string;
  regionCode: string;
  address: string;
  startDate: string;
  endDate: string;
  category: FestivalCategory;
  tags: string[];
  imageUrl?: string;
}

export const FESTIVALS: Festival[] = ${JSON.stringify(rows, null, 2)};
`;

await writeFile("app/lib/data/festivals.mock.ts", header, "utf-8");
console.log("app/lib/data/festivals.mock.ts 생성 완료.");
