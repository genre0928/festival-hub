import { MAP_VIEWBOX, REGIONS } from "./region-data";
import { cn } from "~/lib/utils";

interface DotMapProps {
  regionCounts: Record<string, number>;
  selectedRegion: string | null;
  onSelectRegion: (code: string | null) => void;
  className?: string;
}

const HEX_OFFSETS = Array.from({ length: 6 }, (_, i) => {
  const angle = (Math.PI / 3) * i;
  return { dx: Math.cos(angle) * 6, dy: Math.sin(angle) * 6 };
});

export function DotMap({ regionCounts, selectedRegion, onSelectRegion, className }: DotMapProps) {
  const maxCount = Math.max(1, ...Object.values(regionCounts));

  return (
    <svg
      viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
      className={cn("h-full w-full", className)}
      role="img"
      aria-label="대한민국 축제 개최 지역 도트 지도"
    >
      {REGIONS.map((region) => {
        const count = regionCounts[region.code] ?? 0;
        const isSelected = selectedRegion === region.code;
        const intensity = count / maxCount;
        const dotRadius = 2.4 + Math.min(count, 6) * 0.35;

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

            {isSelected && (
              <circle
                cx={region.x}
                cy={region.y}
                r={14}
                className="fill-season-primary/15"
              />
            )}

            {/* 중심 도트 */}
            <circle
              cx={region.x}
              cy={region.y}
              r={dotRadius}
              className={cn(
                "transition-all duration-300",
                isSelected
                  ? "fill-season-primary"
                  : count > 0
                    ? "fill-season-primary"
                    : "fill-season-muted/40",
              )}
              opacity={isSelected ? 1 : count > 0 ? 0.35 + intensity * 0.65 : 0.5}
            />

            {/* 주변 도트 클러스터 */}
            {HEX_OFFSETS.map((offset, i) => (
              <circle
                key={i}
                cx={region.x + offset.dx}
                cy={region.y + offset.dy}
                r={dotRadius * 0.55}
                className={cn(
                  "transition-all duration-300",
                  isSelected || count > 0 ? "fill-season-primary" : "fill-season-muted/40",
                )}
                opacity={isSelected ? 0.8 : count > 0 ? 0.2 + intensity * 0.5 : 0.35}
              />
            ))}

            {(isSelected || count > 0) && (
              <text
                x={region.x}
                y={region.y - 12}
                textAnchor="middle"
                className={cn(
                  "select-none fill-season-surface-foreground font-medium transition-opacity duration-300",
                  isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-80",
                )}
                fontSize={8}
              >
                {region.name.replace(/(특별자치도|특별자치시|광역시|특별시|도)$/u, "")}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
