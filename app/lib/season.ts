export type Season = "spring" | "summer" | "autumn" | "winter";

export const SEASON_LABELS: Record<Season, string> = {
  spring: "봄",
  summer: "여름",
  autumn: "가을",
  winter: "겨울",
};

export const SEASON_ORDER: Season[] = ["spring", "summer", "autumn", "winter"];

/** 한국 기준 3~5월 봄, 6~8월 여름, 9~11월 가을, 12~2월 겨울 */
export function getSeasonForMonth(month: number): Season {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

export function getCurrentSeason(date: Date = new Date()): Season {
  return getSeasonForMonth(date.getMonth() + 1);
}
