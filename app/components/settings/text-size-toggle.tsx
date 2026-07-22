import { useTextSize } from "~/hooks/use-text-size";
import { cn } from "~/lib/utils";

export function TextSizeToggle() {
  const { textSize, setTextSize } = useTextSize();

  return (
    <div
      role="group"
      aria-label="글자 크기 설정"
      className="flex items-center gap-1 rounded-full border border-season-border bg-season-surface/80 p-1"
    >
      <button
        type="button"
        aria-pressed={textSize === "normal"}
        aria-label="보통 크기 글자"
        title="보통 크기"
        onClick={() => setTextSize("normal")}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-200",
          textSize === "normal"
            ? "bg-season-primary text-season-primary-foreground"
            : "text-season-muted hover:bg-season-secondary hover:text-season-surface-foreground",
        )}
      >
        가
      </button>
      <button
        type="button"
        aria-pressed={textSize === "large"}
        aria-label="큰 크기 글자"
        title="큰 크기"
        onClick={() => setTextSize("large")}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold transition-colors duration-200",
          textSize === "large"
            ? "bg-season-primary text-season-primary-foreground"
            : "text-season-muted hover:bg-season-secondary hover:text-season-surface-foreground",
        )}
      >
        가
      </button>
    </div>
  );
}
