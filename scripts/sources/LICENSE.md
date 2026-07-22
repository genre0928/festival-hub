# 지도 경계 데이터 출처

`skorea-provinces-2018-topo-simple.json`

- 원본: [southkorea/southkorea-maps](https://github.com/southkorea/southkorea-maps) (`kostat/2018/json/skorea-provinces-2018-topo-simple.json`)
- 1차 출처: 통계청 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr/), 2018-12-24 수집
- 라이선스: [공공누리 제1유형](http://www.kogl.or.kr/info/license.do) (출처 표시 시 자유 이용·상업적 이용·변형 가능)

`scripts/build-region-boundaries.mjs`가 이 파일을 읽어 `app/components/map/region-boundaries.ts`(SVG path로 사전 변환된 결과)를 생성한다.
