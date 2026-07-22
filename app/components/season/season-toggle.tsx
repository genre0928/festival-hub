import { Flower2, Leaf, Snowflake, Waves } from "lucide-react";
import { useSeason } from "~/hooks/use-season";
import { SEASON_ORDER, type Season } from "~/lib/season";
import { cn } from "~/lib/utils";

const SEASON_ICONS: Record<Season, typeof Flower2> = {
  spring: Flower2,
  summer: Waves,
  autumn: Leaf,
  winter: Snowflake,
};

const SEASON_TITLES: Record<Season, string> = {
  spring: "봄 테마 (벚꽃)",
  summer: "여름 테마 (바다)",
  autumn: "가을 테마 (단풍)",
  winter: "겨울 테마 (눈)",
};

export function SeasonToggle() {
  const { season, isAuto, setSeason, resetToAuto } = useSeason();

  return (
    <div className="flex items-center gap-1 rounded-full border border-season-border bg-season-surface/80 p-1">
      {SEASON_ORDER.map((s) => {
        const Icon = SEASON_ICONS[s];
        const active = s === season;
        return (
          <button
            key={s}
            type="button"
            title={SEASON_TITLES[s]}
            aria-label={SEASON_TITLES[s]}
            aria-pressed={active}
            onClick={() => (active ? resetToAuto() : setSeason(s))}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200",
              active
                ? "bg-season-primary text-season-primary-foreground"
                : "text-season-muted hover:bg-season-secondary hover:text-season-surface-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
      {!isAuto && (
        <button
          type="button"
          onClick={resetToAuto}
          className="optical-center ml-1 whitespace-nowrap rounded-full px-2 py-1 text-xs text-season-muted hover:text-season-surface-foreground"
        >
          자동으로
        </button>
      )}
    </div>
  );
}
