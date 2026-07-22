import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Calendar } from "~/components/ui/calendar";
import { cn } from "~/lib/utils";

interface DatePickerProps {
  /** YYYY-MM-DD */
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
}

function parseIsoDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function DatePicker({ value, onChange, placeholder = "날짜 선택", className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseIsoDate(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-full border border-season-border bg-season-surface px-4 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-season-ring/60",
            selected ? "text-season-surface-foreground" : "text-season-muted",
            className,
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-season-muted" />
          <span className="flex-1 truncate text-left">
            {selected ? dateFormatter.format(selected) : placeholder}
          </span>
          {selected && (
            <span
              role="button"
              tabIndex={0}
              aria-label="날짜 선택 해제"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(null);
                }
              }}
              className="rounded-full p-0.5 text-season-muted hover:bg-season-secondary hover:text-season-primary"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            onChange(date ? toIsoDate(date) : null);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
