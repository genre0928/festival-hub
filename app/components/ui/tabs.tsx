import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ items, value, onChange, className }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-full border border-season-border bg-season-surface/80 p-1",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200",
              active
                ? "bg-season-primary text-season-primary-foreground shadow-sm"
                : "text-season-muted hover:text-season-surface-foreground",
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
