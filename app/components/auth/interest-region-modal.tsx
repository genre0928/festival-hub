import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { REGIONS } from "~/components/map/region-data";
import { RegionMap } from "~/components/map/region-map";
import { useAuth } from "~/hooks/use-auth";
import { getMySubscriberSettings, saveMySubscriberSettings } from "~/lib/subscriber";
import type { SubscriberFrequency } from "~/lib/supabase/types";
import { cn } from "~/lib/utils";

interface InterestRegionModalProps {
  open: boolean;
  onClose: () => void;
}

export function InterestRegionModal({ open, onClose }: InterestRegionModalProps) {
  const { user } = useAuth();
  const [regions, setRegions] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<SubscriberFrequency>("monthly");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSaved(false);
    getMySubscriberSettings().then((settings) => {
      setRegions(settings.regions);
      setFrequency(settings.frequency);
      setLoading(false);
    });
  }, [open]);

  function toggleRegion(code: string) {
    setRegions((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      await saveMySubscriberSettings(user.id, { regions, frequency, isActive: true });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden p-0">
        <div className="max-h-[85vh] overflow-y-auto p-6">
          <DialogTitle className="pr-8 text-lg font-bold text-season-surface-foreground">
            관심지역 관리
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-season-muted">
            선택한 지역의 축제 소식을 카카오톡으로 받아볼 수 있어요. 아무것도 선택하지 않으면 전체 지역 소식을 받아요.
          </DialogDescription>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-season-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              불러오는 중...
            </div>
          ) : (
            <>
              <div className="mt-4 aspect-[4/3] w-full overflow-hidden rounded-xl border border-season-border bg-season-surface">
                <RegionMap selectedRegions={regions} onToggleRegion={toggleRegion} />
              </div>
              <p className="mt-1.5 text-center text-xs text-season-muted">
                지도를 클릭해서 지역을 선택/해제할 수 있어요
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {REGIONS.map((region) => {
                  const active = regions.includes(region.code);
                  return (
                    <button
                      key={region.code}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleRegion(region.code)}
                      className={cn(
                        "optical-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "border-season-primary bg-season-primary text-season-primary-foreground"
                          : "border-season-border bg-season-surface text-season-surface-foreground hover:bg-season-secondary",
                      )}
                    >
                      {region.name}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5">
                <p className="text-sm font-semibold text-season-surface-foreground">알림 주기</p>
                <div className="mt-2 flex gap-2">
                  {(
                    [
                      { value: "weekly", label: "매주" },
                      { value: "monthly", label: "매달 (이달의 축제)" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={frequency === opt.value}
                      onClick={() => setFrequency(opt.value)}
                      className={cn(
                        "optical-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        frequency === opt.value
                          ? "border-season-primary bg-season-primary text-season-primary-foreground"
                          : "border-season-border bg-season-surface text-season-surface-foreground hover:bg-season-secondary",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                {saved && <span className="text-xs text-season-muted">저장됐어요</span>}
                <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "저장"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
