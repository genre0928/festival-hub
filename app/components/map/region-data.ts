export interface RegionInfo {
  code: string;
  name: string;
  /** 300x420 뷰박스 기준 상대 좌표 (실제 위경도가 아닌 스타일화된 배치) */
  x: number;
  y: number;
}

export const REGIONS: RegionInfo[] = [
  { code: "seoul", name: "서울특별시", x: 120, y: 95 },
  { code: "incheon", name: "인천광역시", x: 88, y: 102 },
  { code: "gyeonggi", name: "경기도", x: 132, y: 122 },
  { code: "gangwon", name: "강원특별자치도", x: 197, y: 75 },
  { code: "chungbuk", name: "충청북도", x: 165, y: 162 },
  { code: "sejong", name: "세종특별자치시", x: 124, y: 178 },
  { code: "chungnam", name: "충청남도", x: 98, y: 172 },
  { code: "daejeon", name: "대전광역시", x: 146, y: 192 },
  { code: "jeonbuk", name: "전북특별자치도", x: 120, y: 228 },
  { code: "gyeongbuk", name: "경상북도", x: 206, y: 182 },
  { code: "daegu", name: "대구광역시", x: 196, y: 227 },
  { code: "gwangju", name: "광주광역시", x: 104, y: 272 },
  { code: "jeonnam", name: "전라남도", x: 96, y: 308 },
  { code: "gyeongnam", name: "경상남도", x: 186, y: 272 },
  { code: "ulsan", name: "울산광역시", x: 227, y: 250 },
  { code: "busan", name: "부산광역시", x: 220, y: 297 },
  { code: "jeju", name: "제주특별자치도", x: 74, y: 388 },
];

export function getRegionByCode(code: string) {
  return REGIONS.find((r) => r.code === code);
}

export const MAP_VIEWBOX = { width: 300, height: 420 };
