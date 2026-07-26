import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "YYYY-MM-DD"를 로컬 자정 Date로 파싱한다. new Date("YYYY-MM-DD")는 UTC 자정으로 해석돼
 * 타임존에 따라 하루 밀릴 수 있어, 오늘 날짜와 비교/표시할 때는 이 함수를 쓴다. */
export function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const fmt = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
  });

  const sameYear = start.getFullYear() === end.getFullYear();
  const yearPrefix = sameYear
    ? `${start.getFullYear()}년 `
    : "";

  return `${yearPrefix}${fmt.format(start)} ~ ${fmt.format(end)}`;
}
