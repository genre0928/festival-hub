import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

interface MarqueeProps {
  children: ReactNode;
  className?: string;
  pauseOnHover?: boolean;
  /** true면 호버 여부와 상관없이 항상 멈춘다(카드에서 연 모달이 떠 있는 동안 등). */
  paused?: boolean;
  reverse?: boolean;
  durationSeconds?: number;
}

export function Marquee({
  children,
  className,
  pauseOnHover = true,
  paused = false,
  reverse = false,
  durationSeconds = 30,
}: MarqueeProps) {
  return (
    <div
      className={cn(
        "group flex min-w-0 overflow-hidden [--gap:1.5rem] gap-[length:var(--gap)]",
        className,
      )}
    >
      {[0, 1].map((i) => (
        <div
          key={i}
          aria-hidden={i === 1}
          className={cn(
            "flex shrink-0 items-center justify-around gap-[length:var(--gap)] animate-marquee",
            reverse && "[animation-direction:reverse]",
            pauseOnHover && "group-hover:[animation-play-state:paused]",
          )}
          style={{
            animationDuration: `${durationSeconds}s`,
            animationPlayState: paused ? "paused" : undefined,
          }}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
