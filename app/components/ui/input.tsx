import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "~/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-full border border-season-border bg-season-surface px-4 text-sm text-season-surface-foreground placeholder:text-season-muted outline-none transition-colors focus-visible:ring-2 focus-visible:ring-season-ring/60",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
