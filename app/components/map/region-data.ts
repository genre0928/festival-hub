export interface RegionInfo {
  code: string;
  name: string;
}

export const REGIONS: RegionInfo[] = [
  { code: "seoul", name: "서울특별시" },
  { code: "incheon", name: "인천광역시" },
  { code: "gyeonggi", name: "경기도" },
  { code: "gangwon", name: "강원특별자치도" },
  { code: "chungbuk", name: "충청북도" },
  { code: "sejong", name: "세종특별자치시" },
  { code: "chungnam", name: "충청남도" },
  { code: "daejeon", name: "대전광역시" },
  { code: "jeonbuk", name: "전북특별자치도" },
  { code: "gyeongbuk", name: "경상북도" },
  { code: "daegu", name: "대구광역시" },
  { code: "gwangju", name: "광주광역시" },
  { code: "jeonnam", name: "전라남도" },
  { code: "gyeongnam", name: "경상남도" },
  { code: "ulsan", name: "울산광역시" },
  { code: "busan", name: "부산광역시" },
  { code: "jeju", name: "제주특별자치도" },
];

export function getRegionByCode(code: string) {
  return REGIONS.find((r) => r.code === code);
}
