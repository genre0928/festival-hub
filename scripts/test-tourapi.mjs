// 로컬 테스트 스크립트: TourAPI(searchFestival2) 응답을 실제로 받아서
// 필드 채움 비율(areacode/카테고리/이미지 등)을 확인하고, 결과를 JSON 파일로 저장한다.
// 실행: node --env-file=.env scripts/test-tourapi.mjs
//
// 이 스크립트는 supabase/functions/sync-festivals/index.ts와 같은 요청 방식을 쓰되,
// 배포 없이 로컬에서 빠르게 응답 형태를 확인하기 위한 용도.

import { writeFile, mkdir } from "node:fs/promises";

const TOUR_API_KEY = process.env.TOUR_API_KEY;
if (!TOUR_API_KEY) {
  console.error("TOUR_API_KEY가 없습니다. .env에 TOUR_API_KEY=... 를 설정하고 `node --env-file=.env scripts/test-tourapi.mjs`로 실행하세요.");
  process.exit(1);
}

const TOUR_API_BASE = "https://apis.data.go.kr/B551011/KorService2/searchFestival2";
const NUM_OF_ROWS = Number(process.argv[2] ?? 50);

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

const url =
  `${TOUR_API_BASE}?serviceKey=${TOUR_API_KEY}` +
  `&MobileOS=ETC&MobileApp=festivalhub&_type=json` +
  `&numOfRows=${NUM_OF_ROWS}&pageNo=1` +
  `&eventStartDate=${eventStartDate}&eventEndDate=${eventEndDate}` +
  `&arrange=A`;

console.log(`요청 기간: ${eventStartDate} ~ ${eventEndDate}, numOfRows=${NUM_OF_ROWS}`);

const res = await fetch(url);
console.log("HTTP status:", res.status);

const json = await res.json();
const header = json?.response?.header;
console.log("resultCode/Msg:", header?.resultCode, header?.resultMsg);

const body = json?.response?.body;
const rawItems = body?.items?.item;
const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

console.log("totalCount:", body?.totalCount);
console.log("이번 요청으로 받은 건수:", items.length);

function rate(pred) {
  const count = items.filter(pred).length;
  return `${count}/${items.length} (${items.length ? Math.round((count / items.length) * 100) : 0}%)`;
}

console.log("\n--- 필드 채움 비율 ---");
console.log("areacode 있음:", rate((it) => !!it.areacode));
console.log("lDongRegnCd 있음:", rate((it) => !!it.lDongRegnCd));
console.log("cat1/cat2/cat3 있음:", rate((it) => !!it.cat1 && !!it.cat2 && !!it.cat3));
console.log("firstimage 있음:", rate((it) => !!it.firstimage));
console.log("mapx/mapy 있음:", rate((it) => !!it.mapx && !!it.mapy));
console.log("eventenddate 있음:", rate((it) => !!it.eventenddate));

// 법정동 시도코드(lDongRegnCd) 기준 매핑 검증용 - 행정안전부 표준 법정동코드
const L_DONG_REGN_MAP = {
  "11": "seoul", "26": "busan", "27": "daegu", "28": "incheon", "29": "gwangju",
  "30": "daejeon", "31": "ulsan", "36": "sejong", "41": "gyeonggi", "42": "gangwon",
  "43": "chungbuk", "44": "chungnam", "45": "jeonbuk", "46": "jeonnam",
  "47": "gyeongbuk", "48": "gyeongnam", "50": "jeju",
};

const areacodeCounts = {};
const cat2Counts = {};
const lDongMappedCounts = {};
for (const it of items) {
  const ac = it.areacode || "(없음)";
  areacodeCounts[ac] = (areacodeCounts[ac] ?? 0) + 1;
  const c2 = it.cat2 || "(없음)";
  cat2Counts[c2] = (cat2Counts[c2] ?? 0) + 1;

  const mapped = L_DONG_REGN_MAP[it.lDongRegnCd] ?? `(미매핑:${it.lDongRegnCd})`;
  lDongMappedCounts[mapped] = (lDongMappedCounts[mapped] ?? 0) + 1;
}
console.log("\nareacode 분포:", areacodeCounts);
console.log("cat2 분포:", cat2Counts);
console.log("lDongRegnCd -> 지역 매핑 분포:", lDongMappedCounts);

console.log("\n--- 샘플 3건 ---");
console.log(JSON.stringify(items.slice(0, 3), null, 2));

await mkdir("scripts/.output", { recursive: true });
const outPath = "scripts/.output/tourapi-sample.json";
await writeFile(outPath, JSON.stringify(json, null, 2), "utf-8");
console.log(`\n전체 응답을 ${outPath} 에 저장했습니다.`);
