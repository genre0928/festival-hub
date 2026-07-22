import { useContext } from "react";
import { TextSizeContext } from "~/components/settings/text-size-provider";

export function useTextSize() {
  const ctx = useContext(TextSizeContext);
  if (!ctx) {
    throw new Error("useTextSize must be used within a TextSizeProvider");
  }
  return ctx;
}
