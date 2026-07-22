import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";

export type TextSize = "normal" | "large";

const STORAGE_KEY = "festival-hub:text-size";

interface TextSizeContextValue {
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
}

export const TextSizeContext = createContext<TextSizeContextValue | null>(null);

function readStoredTextSize(): TextSize {
  if (typeof window === "undefined") return "normal";
  return window.localStorage.getItem(STORAGE_KEY) === "large" ? "large" : "normal";
}

export function TextSizeProvider({ children }: { children: ReactNode }) {
  const [textSize, setTextSizeState] = useState<TextSize>("normal");

  useEffect(() => {
    setTextSizeState(readStoredTextSize());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.textSize = textSize;
  }, [textSize]);

  const setTextSize = useCallback((size: TextSize) => {
    setTextSizeState(size);
    window.localStorage.setItem(STORAGE_KEY, size);
  }, []);

  return (
    <TextSizeContext.Provider value={{ textSize, setTextSize }}>
      {children}
    </TextSizeContext.Provider>
  );
}
