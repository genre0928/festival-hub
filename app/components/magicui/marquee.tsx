import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

interface MarqueeProps {
  children: ReactNode;
  className?: string;
  pauseOnHover?: boolean;
  reverse?: boolean;
  durationSeconds?: number;
}

export function Marquee({
  children,
  className,
  pauseOnHover = true,
  reverse = false,
  durationSeconds = 30,
}: MarqueeProps) {
  return (
    <div
      className={cn(
        "group flex overflow-hidden [--gap:1.5rem] gap-[--gap]",
        className,
      )}
    >
      {[0, 1].map((i) => (
        <div
          key={i}
          aria-hidden={i === 1}
          className={cn(
            "flex shrink-0 items-center justify-around gap-[--gap] animate-marquee",
            reverse && "[animation-direction:reverse]",
            pauseOnHover && "group-hover:[animation-play-state:paused]",
          )}
          style={{ animationDuration: `${durationSeconds}s` }}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
