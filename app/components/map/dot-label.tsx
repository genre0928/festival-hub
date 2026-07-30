interface DotLabelProps {
  x: number;
  y: number;
  label: string;
  /** 정사각형 지도 viewBox의 한 변 길이 - 라벨이 지도 밖으로 벗어나지 않게 보정하는 데 쓴다. */
  mapSize: number;
}

/**
 * PlaceMap/NearbyMap의 점(도트)에 마우스오버했을 때 이름을 보여주는 라벨.
 * <title>만으로는 브라우저 기본 툴팁이라 뜨기까지 시간이 걸려서, RegionMap과 같은 방식으로
 * hover 시 즉시 보이는 라벨을 그린다. 점이 지도 가장자리에 가까우면 라벨이 잘리지 않도록
 * 좌우로는 clamp, 위쪽 공간이 없으면 점 아래쪽에 표시한다.
 */
export function DotLabel({ x, y, label, mapSize }: DotLabelProps) {
  const width = label.length * 6 + 8;
  const height = 14;
  const gap = 8;

  const clampedX = Math.min(Math.max(x, width / 2 + 2), mapSize - width / 2 - 2);
  const showAbove = y - gap - height >= 0;
  const centerY = showAbove ? y - gap - height / 2 : y + gap + height / 2;

  return (
    <g className="pointer-events-none">
      <rect
        x={clampedX - width / 2}
        y={centerY - height / 2}
        width={width}
        height={height}
        rx={4}
        className="fill-season-surface/95"
      />
      <text
        x={clampedX}
        y={centerY}
        textAnchor="middle"
        dominantBaseline="middle"
        className="optical-center select-none fill-season-surface-foreground font-medium"
        fontSize={7}
      >
        {label}
      </text>
    </g>
  );
}
