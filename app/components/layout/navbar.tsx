import { PartyPopper } from "lucide-react";
import { Link } from "react-router";
import { SeasonToggle } from "~/components/season/season-toggle";
import { SEASON_LABELS } from "~/lib/season";
import { useSeason } from "~/hooks/use-season";

export function Navbar() {
  const { season } = useSeason();

  return (
    <header className="sticky top-0 z-20 border-b border-season-border bg-season-surface/70 backdrop-blur-md transition-colors duration-500">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-season-surface-foreground">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-season-primary text-season-primary-foreground">
            <PartyPopper className="h-4 w-4" />
          </span>
          <span className="text-lg">축제 허브</span>
          <span className="hidden text-xs font-normal text-season-muted sm:inline">
            지금은 {SEASON_LABELS[season]}
          </span>
        </Link>

        <SeasonToggle />
      </div>
    </header>
  );
}
