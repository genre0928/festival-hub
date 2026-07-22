import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
