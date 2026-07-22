import { useMemo } from "react";
import type { NearbyCategory, NearbyPlaceWithCategory } from "~/lib/nearby";
import { cn } from "~/lib/utils";

const CATEGORY_COLORS: Record<NearbyCategory, string> = {
  attraction: "#0ea5e9",
  restaurant: "#f97316",
  lodging: "#8b5cf6",
};

const CATEGORY_LABELS: Record<NearbyCategory, string> = {
  attraction: "관광지",
  restaurant: "음식점",
  lodging: "숙소",
};

const SIZE = 200;
const CENTER = SIZE / 2;
const MAX_RADIUS = SIZE / 2 - 16;
const RINGS = [1 / 3, 2 / 3, 1];

interface NearbyMapProps {
  festivalLat: number;
  festivalLng: number;
  places: NearbyPlaceWithCategory[];
  selectedPlaceId: string | null;
  onSelectPlace: (contentId: string) => void;
  className?: string;
}

interface PlottedPlace extends NearbyPlaceWithCategory {
  x: number;
  y: number;
}

export function NearbyMap({
  festivalLat,
  festivalLng,
  places,
  selectedPlaceId,
  onSelectPlace,
  className,
}: NearbyMapProps) {
  const plotted = useMemo<PlottedPlace[]>(() => {
    const cosLat = Math.cos((festivalLat * Math.PI) / 180);
    const withOffsets = places
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p) => {
        const dx = (p.longitude! - festivalLng) * cosLat;
        const dy = -(p.latitude! - festivalLat);
        return { place: p, dx, dy, dist: Math.hypot(dx, dy) };
      });

    const maxDist = Math.max(1e-9, ...withOffsets.map((o) => o.dist));
    const scale = MAX_RADIUS / maxDist;

    return withOffsets.map(({ place, dx, dy }) => ({
      ...place,
      x: CENTER + dx * scale,
      y: CENTER + dy * scale,
    }));
  }, [places, festivalLat, festivalLng]);

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-full w-full rounded-xl bg-season-secondary/40"
        role="img"
        aria-label="축제 위치를 중심으로 한 주변 장소 상대 위치 지도"
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
          const isSelected = p.contentId === selectedPlaceId;
          return (
            <g
              key={p.contentId}
              role="button"
              tabIndex={0}
              aria-label={`${p.title} (${CATEGORY_LABELS[p.category]})`}
              onClick={() => onSelectPlace(p.contentId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectPlace(p.contentId);
                }
              }}
              className="cursor-pointer outline-none"
            >
              <title>{p.title}</title>
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

        {/* 축제 위치(중심) */}
        <circle cx={CENTER} cy={CENTER} r={8} className="fill-season-primary" stroke="white" strokeWidth={2} />
        <circle cx={CENTER} cy={CENTER} r={3} fill="white" />
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-season-muted">
        <LegendItem color="var(--color-season-primary)" label="축제 위치" />
        {(Object.keys(CATEGORY_LABELS) as NearbyCategory[]).map((c) => (
          <LegendItem key={c} color={CATEGORY_COLORS[c]} label={CATEGORY_LABELS[c]} />
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
