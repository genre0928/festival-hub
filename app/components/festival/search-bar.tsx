import { CalendarDays, MapPinned, Search, X } from "lucide-react";
import { REGIONS } from "~/components/map/region-data";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";

interface SearchBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  regionCode: string | null;
  onRegionChange: (value: string | null) => void;
  date: string | null;
  onDateChange: (value: string | null) => void;
}

export function SearchBar({
  query,
  onQueryChange,
  regionCode,
  onRegionChange,
  date,
  onDateChange,
}: SearchBarProps) {
  const hasActiveFilters = query || regionCode || date;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-season-muted" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="축제명, 지역, 태그로 검색"
          className="pl-9"
        />
      </div>

      <div className="relative sm:w-44">
        <MapPinned className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-season-muted" />
        <select
          value={regionCode ?? ""}
          onChange={(e) => onRegionChange(e.target.value || null)}
          className="h-10 w-full appearance-none rounded-full border border-season-border bg-season-surface pl-9 pr-4 text-sm text-season-surface-foreground outline-none focus-visible:ring-2 focus-visible:ring-season-ring/60"
        >
          <option value="">전체 지역</option>
          {REGIONS.map((region) => (
            <option key={region.code} value={region.code}>
              {region.name}
            </option>
          ))}
        </select>
      </div>

      <div className="relative sm:w-44">
        <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-season-muted" />
        <input
          type="date"
          value={date ?? ""}
          onChange={(e) => onDateChange(e.target.value || null)}
          className="h-10 w-full rounded-full border border-season-border bg-season-surface pl-9 pr-4 text-sm text-season-surface-foreground outline-none focus-visible:ring-2 focus-visible:ring-season-ring/60"
        />
      </div>

      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onQueryChange("");
            onRegionChange(null);
            onDateChange(null);
          }}
        >
          <X className="h-3.5 w-3.5" />
          초기화
        </Button>
      )}
    </div>
  );
}
