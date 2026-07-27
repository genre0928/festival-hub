import { PartyPopper } from "lucide-react";
import { Link, NavLink } from "react-router";
import { SeasonToggle } from "~/components/season/season-toggle";
import { TextSizeToggle } from "~/components/settings/text-size-toggle";
import { LoginButton } from "~/components/auth/login-button";
import { UserMenu } from "~/components/auth/user-menu";
import { SEASON_LABELS } from "~/lib/season";
import { useSeason } from "~/hooks/use-season";
import { useAuth } from "~/hooks/use-auth";
import { cn } from "~/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "축제" },
  { to: "/places", label: "지역 정보" },
];

export function Navbar() {
  const { season } = useSeason();
  const { user, loading, isAuthAvailable } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-season-border bg-season-surface/70 backdrop-blur-md transition-colors duration-500">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:min-h-16 sm:gap-4">
        <Link to="/" className="flex shrink-0 items-center gap-2 font-bold text-season-surface-foreground">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-season-primary text-season-primary-foreground">
            <PartyPopper className="h-4 w-4" />
          </span>
          <span className="whitespace-nowrap text-lg">축제 허브</span>
          <span className="hidden whitespace-nowrap text-xs font-normal text-season-muted sm:inline">
            지금은 {SEASON_LABELS[season]}
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "optical-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-season-primary text-season-primary-foreground"
                    : "text-season-muted hover:bg-season-secondary hover:text-season-surface-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <TextSizeToggle />
          <SeasonToggle />
          {isAuthAvailable && !loading && (user ? <UserMenu /> : <LoginButton />)}
        </div>
      </div>
    </header>
  );
}
