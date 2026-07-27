import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DateRange, type DayContentProps } from "react-day-picker";
import { ko } from "date-fns/locale";
import { cn } from "~/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * 오늘 날짜 칸에는 숫자 위에 "오늘"이라고 작게 써서 한눈에 알아보게 한다.
 * 2개월을 나란히 보여줄 때, 다음 달 첫 주 앞을 채우는 "지난달 꼬리"(outside) 칸이
 * 오늘 날짜와 겹치는 경우가 있어(예: 8월 1일이 토요일이면 7/26~31이 8월 칸 앞에 딸려옴),
 * 그 칸까지 "오늘"로 표시되면 두 번 나온 것처럼 보인다. outside 칸은 제외하고 실제
 * 그 달에 속한 칸에서만 표시한다. 테두리는 배경색과 상관없이 보이도록 ring-current를 쓴다.
 */
function CalendarDayContent({ date, activeModifiers }: DayContentProps) {
  const isToday = !activeModifiers.outside && isSameLocalDay(date, new Date());
  if (!isToday) return <>{date.getDate()}</>;
  return (
    <span className="flex h-full w-full flex-col items-center justify-center rounded-full leading-none ring-1 ring-inset ring-current">
      <span className="text-[8px] font-bold leading-none">오늘</span>
      <span className="text-[11px] font-semibold leading-none">{date.getDate()}</span>
    </span>
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  modifiers,
  modifiersClassNames,
  ...props
}: CalendarProps) {
  // range 선택에서 한 주가 전부 범위에 포함되면 그 줄의 일요일/토요일 칸도 둥글게 캡을
  // 씌워서, 여러 주에 걸친 긴 기간이 주 단위로 끊어진 알약 모양의 띠처럼 보이게 한다.
  const selectedRange = props.mode === "range" ? (props.selected as DateRange | undefined) : undefined;
  function isInSelectedRange(date: Date): boolean {
    if (!selectedRange?.from) return false;
    const to = selectedRange.to ?? selectedRange.from;
    return date >= selectedRange.from && date <= to;
  }

  return (
    <DayPicker
      locale={ko}
      showOutsideDays={showOutsideDays}
      className={cn("p-1", className)}
      modifiers={{
        ...modifiers,
        weekRowStart: (date) => isInSelectedRange(date) && date.getDay() === 0,
        weekRowEnd: (date) => isInSelectedRange(date) && date.getDay() === 6,
      }}
      modifiersClassNames={{
        ...modifiersClassNames,
        weekRowStart: "rounded-l-full",
        weekRowEnd: "rounded-r-full",
      }}
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
        day: "h-9 w-9 p-0 font-normal text-season-surface-foreground hover:bg-season-secondary transition-colors aria-selected:opacity-100",
        day_selected:
          "rounded-full bg-season-primary text-season-primary-foreground hover:bg-season-primary hover:text-season-primary-foreground focus:bg-season-primary focus:text-season-primary-foreground",
        // "오늘" 표시는 CalendarDayContent에서 직접 계산해 그려서(위 주석 참고), 여기서는
        // react-day-picker의 today 모디파이어에 따른 기본 스타일을 주지 않는다.
        day_today: "",
        day_outside: "text-season-muted opacity-40",
        day_disabled: "text-season-muted opacity-30",
        // 기간(range) 선택은 하루하루를 따로 동그라미 치면 산만해서, 시작/끝만 둥글게 캡을
        // 씌우고 가운데는 각지게 이어 붙여 하나의 띠처럼 보이게 한다. 시작일/종료일을 굳이
        // 구분할 필요는 없어서 셋 다 같은 색으로 채운다(주 전체가 범위에 포함되면
        // weekRowStart/End 모디파이어가 그 줄의 일/토요일 칸도 마저 둥글게 캡을 씌워준다).
        day_range_start: "rounded-l-full rounded-r-none bg-season-primary text-season-primary-foreground",
        day_range_end: "rounded-r-full rounded-l-none bg-season-primary text-season-primary-foreground",
        day_range_middle: "rounded-none bg-season-primary text-season-primary-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
        DayContent: CalendarDayContent,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
