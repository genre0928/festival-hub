import { useSeason } from "~/hooks/use-season";
import { Particles } from "~/components/magicui/particles";
import { cn } from "~/lib/utils";
import type { Season } from "~/lib/season";

interface SeasonVisualConfig {
  quantity: number;
  colors: string[];
  shape: "circle" | "petal";
  minSize: number;
  maxSize: number;
  fallSpeed: number;
  sway: number;
}

const SEASON_VISUALS: Record<Season, SeasonVisualConfig> = {
  spring: {
    quantity: 34,
    colors: ["#fbcfe8", "#f9a8d4", "#fda4d0", "#ffe4ee"],
    shape: "petal",
    minSize: 6,
    maxSize: 12,
    fallSpeed: 26,
    sway: 40,
  },
  summer: {
    quantity: 26,
    colors: ["#bae6fd", "#e0f2fe", "#7dd3fc"],
    shape: "circle",
    minSize: 3,
    maxSize: 7,
    fallSpeed: 18,
    sway: 14,
  },
  autumn: {
    quantity: 30,
    colors: ["#f97316", "#c2410c", "#facc15", "#b45309"],
    shape: "petal",
    minSize: 6,
    maxSize: 11,
    fallSpeed: 32,
    sway: 46,
  },
  winter: {
    quantity: 40,
    colors: ["#ffffff", "#e0e7ff", "#cbd5f5"],
    shape: "circle",
    minSize: 3,
    maxSize: 6,
    fallSpeed: 22,
    sway: 24,
  },
};

export function SeasonalBackground({ className }: { className?: string }) {
  const { season } = useSeason();
  const visual = SEASON_VISUALS[season];

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-b from-season-bg-from via-season-bg-via to-season-bg-to transition-colors duration-700",
        className,
      )}
    >
      <Particles
        key={season}
        quantity={visual.quantity}
        colors={visual.colors}
        shape={visual.shape}
        minSize={visual.minSize}
        maxSize={visual.maxSize}
        fallSpeed={visual.fallSpeed}
        sway={visual.sway}
      />
      {season === "summer" && <SummerWaves />}
    </div>
  );
}

function SummerWaves() {
  return (
    <div className="absolute inset-x-0 bottom-0 h-40 overflow-hidden opacity-60">
      <svg
        className="absolute bottom-0 h-full w-[200%] animate-[wave_14s_linear_infinite] text-season-primary/30"
        viewBox="0 0 1440 200"
        preserveAspectRatio="none"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M0,100 C240,160 480,40 720,100 C960,160 1200,40 1440,100 L1440,200 L0,200 Z" />
      </svg>
      <svg
        className="absolute bottom-0 h-full w-[200%] animate-[wave_20s_linear_infinite_reverse] text-season-primary/20"
        viewBox="0 0 1440 200"
        preserveAspectRatio="none"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M0,120 C240,60 480,180 720,120 C960,60 1200,180 1440,120 L1440,200 L0,200 Z" />
      </svg>
    </div>
  );
}
