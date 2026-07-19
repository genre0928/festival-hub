import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getCurrentSeason, type Season } from "~/lib/season";

interface SeasonContextValue {
  season: Season;
  isAuto: boolean;
  setSeason: (season: Season) => void;
  resetToAuto: () => void;
}

export const SeasonContext = createContext<SeasonContextValue | null>(null);

export function SeasonProvider({ children }: { children: ReactNode }) {
  const autoSeason = useMemo(() => getCurrentSeason(), []);
  const [season, setSeasonState] = useState<Season>(autoSeason);
  const [isAuto, setIsAuto] = useState(true);

  useEffect(() => {
    document.documentElement.dataset.season = season;
  }, [season]);

  const setSeason = useCallback(
    (next: Season) => {
      setSeasonState(next);
      setIsAuto(next === autoSeason);
    },
    [autoSeason],
  );

  const resetToAuto = useCallback(() => {
    setSeasonState(autoSeason);
    setIsAuto(true);
  }, [autoSeason]);

  const value = useMemo(
    () => ({ season, isAuto, setSeason, resetToAuto }),
    [season, isAuto, setSeason, resetToAuto],
  );

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}
