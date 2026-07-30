import { useState } from "react";
import { MAP_VIEWBOX, REGION_BOUNDARIES } from "./region-boundaries";
import { cn } from "~/lib/utils";

// REGION_BOUNDARIES의 원본 좌표는 실제 육지가 y축 75.4~344.6 안에만 있고 그 위아래로는 빈
// 공간이라(전체 viewBox는 0~420), 그대로 쓰면 지도 위아래로 넓은 여백이 생긴다. 라벨이
// 잘리지 않을 만큼만(약 2 단위) 여유를 두고 실제 육지 범위에 바짝 잘라 채운다.
const MAP_CROP_Y = 73;
const MAP_CROP_HEIGHT = 274;

interface RegionMapProps {
  /** 지역별 축제 건수 (색 농도용). 다중 선택 모드(관심지역 관리 등)에서는 필요 없음 */
  regionCounts?: Record<string, number>;
  /** 단일 선택 모드(홈 화면 필터): 지역 하나만 선택/해제 */
  selectedRegion?: string | null;
  onSelectRegion?: (code: string | null) => void;
  /** 다중 선택 모드(관심지역 관리): 여러 지역을 토글로 켜고 끔. 이 값이 있으면 다중 선택 모드로 동작 */
  selectedRegions?: string[];
  onToggleRegion?: (code: string) => void;
  className?: string;
}

export function RegionMap({
  regionCounts = {},
  selectedRegion = null,
  onSelectRegion,
  selectedRegions,
  onToggleRegion,
  className,
}: RegionMapProps) {
  const isMultiSelect = selectedRegions !== undefined;
  const maxCount = Math.max(1, ...Object.values(regionCounts));
  // 라벨을 경계선과 같은 <g>에 두면 나중에 그려지는(=배열상 뒤쪽) 다른 지역 path가
  // 앞선 지역의 라벨을 덮어버린다. 이를 막기 위해 path를 먼저 전부 그리고, 라벨은
  // 항상 맨 위에 오도록 별도 pass로 그린다 - hover 상태도 그래서 CSS group-hover
  // 대신 React state로 관리한다(두 pass가 서로 다른 <g>라 group-hover가 안 통함).
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  // 여러 지역이 한꺼번에 선택되면(다중 선택 모드) 서로 가까운 지역의 라벨이 겹쳐서 잘 안
  // 보이는 문제가 있었다. z-index를 조정해도 겹치는 두 라벨이 동시에 보여야 하는 이상 근본
  // 해결이 안 돼서, 선택된 지역이 정확히 1개일 때만 라벨을 항상 표시하고 그 외엔 마우스
  // 오버(한 번에 하나만 뜨니 절대 겹치지 않음)로만 이름을 확인하도록 방식을 바꿨다.
  const selectedCount = isMultiSelect ? (selectedRegions ?? []).length : selectedRegion ? 1 : 0;

  return (
    <svg
      viewBox={`0 ${MAP_CROP_Y} ${MAP_VIEWBOX.width} ${MAP_CROP_HEIGHT}`}
      className={cn("h-full w-full", className)}
      role="img"
      aria-label="대한민국 시도 행정구역 경계 지도, 지역별 축제 개최 현황"
    >
      {REGION_BOUNDARIES.map((region) => {
        const count = regionCounts[region.code] ?? 0;
        const isSelected = isMultiSelect
          ? (selectedRegions ?? []).includes(region.code)
          : selectedRegion === region.code;
        const intensity = count / maxCount;

        const handleSelect = () => {
          if (isMultiSelect) {
            onToggleRegion?.(region.code);
          } else {
            onSelectRegion?.(isSelected ? null : region.code);
          }
        };
        const clearHover = () =>
          setHoveredRegion((prev) => (prev === region.code ? null : prev));

        return (
          <g
            key={region.code}
            role="button"
            tabIndex={0}
            aria-label={`${region.name}${isMultiSelect ? "" : ` (축제 ${count}건)`}${isSelected ? ", 선택됨" : ""}`}
            aria-pressed={isSelected}
            onClick={handleSelect}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSelect();
              }
            }}
            onMouseEnter={() => setHoveredRegion(region.code)}
            onMouseLeave={clearHover}
            className="cursor-pointer outline-none"
          >
            <title>{isMultiSelect ? region.name : `${region.name} · 축제 ${count}건`}</title>

            <path
              d={region.path}
              className={cn(
                "transition-colors duration-300",
                isSelected
                  ? "fill-season-primary stroke-season-primary"
                  : count > 0
                    ? "fill-season-primary stroke-season-border hover:stroke-season-primary/70"
                    : "fill-season-muted/10 stroke-season-border hover:fill-season-muted/20",
              )}
              strokeWidth={isSelected ? 1.6 : 0.8}
              fillOpacity={isSelected ? 0.85 : count > 0 ? 0.25 + intensity * 0.6 : 1}
              strokeLinejoin="round"
            />
          </g>
        );
      })}

      {REGION_BOUNDARIES.map((region) => {
        const count = regionCounts[region.code] ?? 0;
        const isSelected = isMultiSelect
          ? (selectedRegions ?? []).includes(region.code)
          : selectedRegion === region.code;
        const showLabel =
          (isSelected && selectedCount === 1) ||
          (hoveredRegion === region.code && (isMultiSelect || count > 0));
        if (!showLabel) return null;

        return (
          <g key={region.code} className="pointer-events-none">
            <rect
              x={region.cx - region.name.length * 3.6 - 3}
              y={region.cy - 6}
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
              className="optical-center select-none fill-season-surface-foreground font-medium"
              fontSize={7}
            >
              {region.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
