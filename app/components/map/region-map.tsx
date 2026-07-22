import { MAP_VIEWBOX, REGION_BOUNDARIES } from "./region-boundaries";
import { cn } from "~/lib/utils";

interface RegionMapProps {
  regionCounts: Record<string, number>;
  selectedRegion: string | null;
  onSelectRegion: (code: string | null) => void;
  className?: string;
}

export function RegionMap({ regionCounts, selectedRegion, onSelectRegion, className }: RegionMapProps) {
  const maxCount = Math.max(1, ...Object.values(regionCounts));

  return (
    <svg
      viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
      className={cn("h-full w-full", className)}
      role="img"
      aria-label="대한민국 시도 행정구역 경계 지도, 지역별 축제 개최 현황"
    >
      {REGION_BOUNDARIES.map((region) => {
        const count = regionCounts[region.code] ?? 0;
        const isSelected = selectedRegion === region.code;
        const intensity = count / maxCount;

        const handleSelect = () => onSelectRegion(isSelected ? null : region.code);

        return (
          <g
            key={region.code}
            role="button"
            tabIndex={0}
            aria-label={`${region.name} (축제 ${count}건)${isSelected ? ", 선택됨" : ""}`}
            aria-pressed={isSelected}
            onClick={handleSelect}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSelect();
              }
            }}
            className="group cursor-pointer outline-none"
          >
            <title>{`${region.name} · 축제 ${count}건`}</title>

            <path
              d={region.path}
              className={cn(
                "transition-colors duration-300",
                isSelected
                  ? "fill-season-primary stroke-season-primary"
                  : count > 0
                    ? "fill-season-primary stroke-season-border group-hover:stroke-season-primary/70"
                    : "fill-season-muted/10 stroke-season-border group-hover:fill-season-muted/20",
              )}
              strokeWidth={isSelected ? 1.6 : 0.8}
              fillOpacity={isSelected ? 0.85 : count > 0 ? 0.25 + intensity * 0.6 : 1}
              strokeLinejoin="round"
            />

            {(isSelected || count > 0) && (
              <g
                className={cn(
                  "pointer-events-none transition-opacity duration-300",
                  isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
              >
                <rect
                  x={region.cx - region.name.length * 3.6 - 3}
                  y={region.cy - 9}
                  width={region.name.length * 7.2 + 6}
                  height={12}
                  rx={6}
                  className="fill-season-surface/90"
                />
                <text
                  x={region.cx}
                  y={region.cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="select-none fill-season-surface-foreground font-medium"
                  fontSize={7}
                >
                  {region.name}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
