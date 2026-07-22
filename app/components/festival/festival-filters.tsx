import { CalendarClock, CheckCircle2, LayoutGrid, PlayCircle } from "lucide-react";
import { Tabs, type TabItem } from "~/components/ui/tabs";
import type { FestivalStatus } from "~/lib/festivals";

export type StatusFilter = FestivalStatus | "all";

const ITEMS: TabItem<StatusFilter>[] = [
  { value: "all", label: "전체", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { value: "ongoing", label: "진행중", icon: <PlayCircle className="h-3.5 w-3.5" /> },
  { value: "upcoming", label: "진행예정", icon: <CalendarClock className="h-3.5 w-3.5" /> },
  { value: "ended", label: "종료", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
];

interface FestivalFiltersProps {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
}

export function FestivalFilters({ value, onChange }: FestivalFiltersProps) {
  return <Tabs items={ITEMS} value={value} onChange={onChange} />;
}
