import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ko } from "date-fns/locale";
import { cn } from "~/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={ko}
      showOutsideDays={showOutsideDays}
      className={cn("p-1", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-3",
        caption: "flex justify-center pt-1 relative items-center w-full",
        caption_label: "text-sm font-medium text-season-surface-foreground",
        nav: "flex items-center gap-1",
        nav_button:
          "h-7 w-7 rounded-full flex items-center justify-center text-season-muted hover:bg-season-secondary hover:text-season-surface-foreground transition-colors",
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell: "text-season-muted rounded-md w-9 font-normal text-xs",
        row: "flex w-full mt-1",
        cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day: "h-9 w-9 rounded-full p-0 font-normal text-season-surface-foreground hover:bg-season-secondary transition-colors aria-selected:opacity-100",
        day_selected:
          "bg-season-primary text-season-primary-foreground hover:bg-season-primary hover:text-season-primary-foreground focus:bg-season-primary focus:text-season-primary-foreground",
        day_today: "border border-season-primary text-season-primary font-semibold",
        day_outside: "text-season-muted opacity-40",
        day_disabled: "text-season-muted opacity-30",
        day_range_middle: "aria-selected:bg-season-secondary aria-selected:text-season-surface-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
