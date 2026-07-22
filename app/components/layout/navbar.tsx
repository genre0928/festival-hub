import { PartyPopper } from "lucide-react";
import { Link } from "react-router";
import { SeasonToggle } from "~/components/season/season-toggle";
import { TextSizeToggle } from "~/components/settings/text-size-toggle";
import { SEASON_LABELS } from "~/lib/season";
import { useSeason } from "~/hooks/use-season";

export function Navbar() {
  const { season } = useSeason();

  return (
    <header className="sticky top-0 z-20 border-b border-season-border bg-season-surface/70 backdrop-blur-md transition-colors duration-500">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:h-16 sm:flex-nowrap sm:gap-4 sm:py-0">
        <Link to="/" className="flex items-center gap-2 font-bold text-season-surface-foreground">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-season-primary text-season-primary-foreground">
            <PartyPopper className="h-4 w-4" />
          </span>
          <span className="text-lg">축제 허브</span>
          <span className="hidden text-xs font-normal text-season-muted sm:inline">
            지금은 {SEASON_LABELS[season]}
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <TextSizeToggle />
          <SeasonToggle />
        </div>
      </div>
    </header>
  );
}
