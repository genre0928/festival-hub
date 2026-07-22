// scripts/sources/skorea-provinces-2018-topo-simple.json(TopoJSON, KOGL 1유형)을 읽어서
// SVG로 바로 그릴 수 있는 path 문자열로 미리 변환해 app/components/map/region-boundaries.ts를 생성한다.
// 지도 좌표(lon/lat)를 앱의 SVG 좌표계로 바꾸는 무거운 계산(위경도 투영)을 빌드 타임에 끝내서
// 런타임에는 topojson-client 없이 순수 문자열만 그리면 되게 하기 위함.
//
// 실행: node scripts/build-region-boundaries.mjs

import { readFile, writeFile } from "node:fs/promises";
import { feature } from "topojson-client";

const VIEWBOX_WIDTH = 300;
const VIEWBOX_HEIGHT = 420;
const PADDING = 6;

/** GeoJSON properties.name(한글 행정구역명) -> 이 프로젝트의 내부 지역 코드 */
const NAME_TO_CODE = {
  서울특별시: "seoul",
  인천광역시: "incheon",
  경기도: "gyeonggi",
  강원도: "gangwon",
  "강원특별자치도": "gangwon",
  충청북도: "chungbuk",
  세종특별자치시: "sejong",
  충청남도: "chungnam",
  대전광역시: "daejeon",
  전라북도: "jeonbuk",
  "전북특별자치도": "jeonbuk",
  경상북도: "gyeongbuk",
  대구광역시: "daegu",
  광주광역시: "gwangju",
  전라남도: "jeonnam",
  경상남도: "gyeongnam",
  울산광역시: "ulsan",
  부산광역시: "busan",
  제주특별자치도: "jeju",
};

const topology = JSON.parse(
  await readFile("scripts/sources/skorea-provinces-2018-topo-simple.json", "utf-8"),
);
const objectKey = Object.keys(topology.objects)[0];
const collection = feature(topology, topology.objects[objectKey]);

const [minLon, minLat, maxLon, maxLat] = topology.bbox;
const centerLat = (minLat + maxLat) / 2;
const cosLat = Math.cos((centerLat * Math.PI) / 180);

// 1단계: 경도/위도를 등거리원통(equirectangular) 투영 + 위도 보정만 적용 (아직 스케일/이동 전)
function projectRaw([lon, lat]) {
  return [lon * cosLat, -lat];
}

function mapCoordinates(coords, depth, fn) {
  if (depth === 0) return fn(coords);
  return coords.map((c) => mapCoordinates(c, depth - 1, fn));
}

function geometryDepth(type) {
  // Polygon: number[][][] (ring[point[lon,lat]]) -> point까지 depth 2
  // MultiPolygon: number[][][][] -> depth 3
  return type === "MultiPolygon" ? 3 : 2;
}

const rawByFeature = collection.features.map((f) => {
  const depth = geometryDepth(f.geometry.type);
  return mapCoordinates(f.geometry.coordinates, depth, projectRaw);
});

// 2단계: 전체 bounding box를 구해서 viewBox에 맞게 균일 스케일 + 중앙 정렬
let minX = Infinity;
let minY = Infinity;
let maxX = -Infinity;
let maxY = -Infinity;
function visitPoints(coords, depth, cb) {
  if (depth === 0) return cb(coords);
  coords.forEach((c) => visitPoints(c, depth - 1, cb));
}
collection.features.forEach((f, i) => {
  const depth = geometryDepth(f.geometry.type);
  visitPoints(rawByFeature[i], depth, ([x, y]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
});

const geoWidth = maxX - minX;
const geoHeight = maxY - minY;
const availableWidth = VIEWBOX_WIDTH - PADDING * 2;
const availableHeight = VIEWBOX_HEIGHT - PADDING * 2;
const scale = Math.min(availableWidth / geoWidth, availableHeight / geoHeight);
const offsetX = PADDING + (availableWidth - geoWidth * scale) / 2 - minX * scale;
const offsetY = PADDING + (availableHeight - geoHeight * scale) / 2 - minY * scale;

function toSvg([x, y]) {
  return [Number((x * scale + offsetX).toFixed(1)), Number((y * scale + offsetY).toFixed(1))];
}

/**
 * Douglas-Peucker 선 단순화. "simple" topojson도 300x420짜리 지도에 그리기엔
 * 정점이 너무 많아(약 3만개) 번들 크기가 커져서, 화면에서 안 보일 만큼 작은
 * 오차(epsilon, SVG 좌표 단위)로 추가 단순화한다.
 */
function simplify(points, epsilon) {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIndex = 0;
  const [x1, y1] = points[0];
  const [x2, y2] = points[points.length - 1];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lineLenSq = dx * dx + dy * dy;

  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    let dist;
    if (lineLenSq === 0) {
      dist = Math.hypot(px - x1, py - y1);
    } else {
      const t = ((px - x1) * dx + (py - y1) * dy) / lineLenSq;
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      dist = Math.hypot(px - projX, py - projY);
    }
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplify(points.slice(0, maxIndex + 1), epsilon);
    const right = simplify(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[points.length - 1]];
}

const SIMPLIFY_EPSILON = 0.35;

function ringToPath(ring) {
  const points = simplify(ring.map(toSvg), SIMPLIFY_EPSILON);
  return `M${points.map(([x, y]) => `${x},${y}`).join("L")}Z`;
}

function polygonToPath(polygon) {
  return polygon.map(ringToPath).join(" ");
}

function geometryToPath(type, rawCoords) {
  if (type === "Polygon") return polygonToPath(rawCoords);
  return rawCoords.map(polygonToPath).join(" ");
}

/** 가장 큰 외곽 링의 정점 평균으로 라벨/포커스용 대략적인 중심점을 구한다 (엄밀한 폴리곤 중심 아님) */
function approximateCentroid(type, rawCoords) {
  const rings = type === "Polygon" ? rawCoords : rawCoords.flat();
  let biggest = rings[0];
  for (const ring of rings) {
    if (ring.length > biggest.length) biggest = ring;
  }
  const sum = biggest.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  const [cx, cy] = [sum[0] / biggest.length, sum[1] / biggest.length];
  return toSvg([cx, cy]);
}

const regions = [];
const unmatched = [];

collection.features.forEach((f, i) => {
  const code = NAME_TO_CODE[f.properties.name];
  if (!code) {
    unmatched.push(f.properties.name);
    return;
  }
  const path = geometryToPath(f.geometry.type, rawByFeature[i]);
  const [cx, cy] = approximateCentroid(f.geometry.type, rawByFeature[i]);
  regions.push({ code, name: f.properties.name, path, cx, cy });
});

if (unmatched.length > 0) {
  console.warn("매칭 실패한 지역명:", unmatched);
}
console.log(`${regions.length}/${collection.features.length}개 지역 변환 완료`);

const output = `// scripts/build-region-boundaries.mjs 로 생성된 파일. 직접 수정하지 말 것.
// 원본: scripts/sources/skorea-provinces-2018-topo-simple.json (공공누리 1유형, 출처: 통계청 SGIS)
// 재생성: node scripts/build-region-boundaries.mjs

export interface RegionBoundary {
  code: string;
  name: string;
  /** SVG path의 d 속성 값 */
  path: string;
  /** 라벨/포커스용 대략적인 중심 좌표 */
  cx: number;
  cy: number;
}

export const MAP_VIEWBOX = { width: ${VIEWBOX_WIDTH}, height: ${VIEWBOX_HEIGHT} };

export const REGION_BOUNDARIES: RegionBoundary[] = ${JSON.stringify(regions, null, 2)};
`;

await writeFile("app/components/map/region-boundaries.ts", output, "utf-8");
console.log("app/components/map/region-boundaries.ts 생성 완료.");
