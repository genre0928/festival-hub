import { useState } from "react";
import { LogOut, MapPinned, User as UserIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { InterestRegionModal } from "~/components/auth/interest-region-modal";
import { useAuth } from "~/hooks/use-auth";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const [regionModalOpen, setRegionModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const metadata = user.user_metadata as Record<string, unknown>;
  const displayName = (metadata?.name as string) || (metadata?.full_name as string) || "내 계정";
  const avatarUrl = metadata?.avatar_url as string | undefined;

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="계정 메뉴"
            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-season-border bg-season-surface text-season-muted hover:bg-season-secondary"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserIcon className="h-4 w-4" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 p-1.5">
          <p className="truncate px-2 py-1.5 text-xs text-season-muted">{displayName}</p>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setRegionModalOpen(true);
            }}
            className="optical-center flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm text-season-surface-foreground hover:bg-season-secondary"
          >
            <MapPinned className="h-4 w-4 text-season-muted" />
            관심지역 관리
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              signOut();
            }}
            className="optical-center flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm text-season-surface-foreground hover:bg-season-secondary"
          >
            <LogOut className="h-4 w-4 text-season-muted" />
            로그아웃
          </button>
        </PopoverContent>
      </Popover>

      <InterestRegionModal open={regionModalOpen} onClose={() => setRegionModalOpen(false)} />
    </>
  );
}
