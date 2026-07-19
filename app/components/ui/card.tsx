import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "~/lib/utils";

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-season-border bg-season-surface/90 backdrop-blur-sm shadow-sm transition-colors duration-500",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";
