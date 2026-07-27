import { useMemo } from "react";
import type { Place, PlaceCategory } from "~/lib/places";
import { PLACE_CATEGORY_LABELS } from "~/lib/places";
import { cn } from "~/lib/utils";

const CATEGORY_COLORS: Record<PlaceCategory, string> = {
  attraction: "#0ea5e9",
  restaurant: "#f97316",
  lodging: "#8b5cf6",
};

const SIZE = 200;
const CENTER = SIZE / 2;
const MAX_RADIUS = SIZE / 2 - 16;
const RINGS = [1 / 3, 2 / 3, 1];

interface PlaceMapProps {
  centerLat: number;
  centerLng: number;
  places: Place[];
  selectedPlaceId: string | null;
  onSelectPlace: (id: string) => void;
  className?: string;
}

interface PlottedPlace extends Place {
  x: number;
  y: number;
}

/** 검색 좌표를 중심으로 그 지역 장소들을 상대 위치의 점으로 찍어 보여준다(NearbyMap과 같은 방식). */
export function PlaceMap({ centerLat, centerLng, places, selectedPlaceId, onSelectPlace, className }: PlaceMapProps) {
  const plotted = useMemo<PlottedPlace[]>(() => {
    const cosLat = Math.cos((centerLat * Math.PI) / 180);
    const withOffsets = places
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p) => {
        const dx = (p.longitude! - centerLng) * cosLat;
        const dy = -(p.latitude! - centerLat);
        return { place: p, dx, dy, dist: Math.hypot(dx, dy) };
      });

    // 가장 먼 점 하나를 기준으로 스케일을 잡으면, 그 점이 유독 멀리 떨어져 있을 때
    // 나머지 대부분이 중심 근처에 겹쳐 찍혀 "1개만 보이는" 것처럼 보이는 문제가 있었다.
    // 90번째 백분위 거리를 기준으로 스케일을 잡고, 그보다 먼 점은 화면 가장자리에
    // 붙여서(clamp) 소수의 원거리 이상치가 전체 스케일을 망치지 않게 한다.
    const sortedDist = withOffsets.map((o) => o.dist).sort((a, b) => a - b);
    const percentileIdx = Math.min(sortedDist.length - 1, Math.floor(sortedDist.length * 0.9));
    const referenceDist = Math.max(1e-9, sortedDist[percentileIdx] ?? 1e-9);
    const scale = MAX_RADIUS / referenceDist;

    return withOffsets.map(({ place, dx, dy }) => {
      const rawX = dx * scale;
      const rawY = dy * scale;
      const rawDist = Math.hypot(rawX, rawY);
      const clamp = rawDist > MAX_RADIUS ? MAX_RADIUS / rawDist : 1;
      return {
        ...place,
        x: CENTER + rawX * clamp,
        y: CENTER + rawY * clamp,
      };
    });
  }, [places, centerLat, centerLng]);

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-full w-full rounded-xl bg-season-secondary/40"
        role="img"
        aria-label="검색한 위치를 중심으로 한 주변 장소 상대 위치 지도"
      >
        {RINGS.map((r) => (
          <circle
            key={r}
            cx={CENTER}
            cy={CENTER}
            r={MAX_RADIUS * r}
            className="fill-none stroke-season-border"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        ))}

        {plotted.map((p) => {
          const isSelected = p.id === selectedPlaceId;
          return (
            <g
              key={p.id}
              role="button"
              tabIndex={0}
              aria-label={`${p.name} (${PLACE_CATEGORY_LABELS[p.category]})`}
              onClick={() => onSelectPlace(p.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectPlace(p.id);
                }
              }}
              className="cursor-pointer outline-none"
            >
              <title>{p.name}</title>
              <circle
                cx={p.x}
                cy={p.y}
                r={isSelected ? 6.5 : 5}
                fill={CATEGORY_COLORS[p.category]}
                stroke="white"
                strokeWidth={isSelected ? 2 : 1.2}
                opacity={isSelected ? 1 : 0.85}
              />
            </g>
          );
        })}

        {/* 검색한 위치(중심) */}
        <circle cx={CENTER} cy={CENTER} r={8} className="fill-season-primary" stroke="white" strokeWidth={2} />
        <circle cx={CENTER} cy={CENTER} r={3} fill="white" />
      </svg>

      {/* 4개 항목이 좁은 폭에서 flex-wrap으로 줄바꿈되면 2+1+1처럼 삐뚤빼뚤해 보여서,
          2x2 grid로 고정하고 넓어지면(sm+) 원래대로 한 줄 flex로 되돌린다. */}
      <div className="mt-2 grid grid-cols-2 justify-items-center gap-x-3 gap-y-1 text-[11px] text-season-muted sm:flex sm:flex-wrap sm:justify-center">
        <LegendItem color="var(--color-season-primary)" label="검색 위치" />
        {(Object.keys(PLACE_CATEGORY_LABELS) as PlaceCategory[]).map((c) => (
          <LegendItem key={c} color={CATEGORY_COLORS[c]} label={PLACE_CATEGORY_LABELS[c]} />
        ))}
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
