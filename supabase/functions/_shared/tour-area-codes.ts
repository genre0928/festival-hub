// TourAPI(KorService2) 자체 지역코드(areaCode) <-> 이 프로젝트의 내부 지역 코드 매핑.
// festivals 동기화에 쓰는 법정동 시도코드(lDongRegnCd)와는 다른, TourAPI areaBasedList2
// 전용 코드 체계다(예: 서울=1, 부산=6, 경기=31 ...).

export const TOUR_AREA_CODE: Record<string, string> = {
  seoul: "1",
  incheon: "2",
  daejeon: "3",
  daegu: "4",
  gwangju: "5",
  busan: "6",
  ulsan: "7",
  sejong: "8",
  gyeonggi: "31",
  gangwon: "32",
  chungbuk: "33",
  chungnam: "34",
  gyeongbuk: "35",
  gyeongnam: "36",
  jeonbuk: "37",
  jeonnam: "38",
  jeju: "39",
};
