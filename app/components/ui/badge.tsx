import { type HTMLAttributes } from "react";
import { cn } from "~/lib/utils";

type BadgeVariant = "solid" | "soft" | "outline";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  solid: "bg-season-primary text-season-primary-foreground",
  soft: "bg-season-secondary text-season-surface-foreground",
  outline: "border border-season-border text-season-surface-foreground",
};

export function Badge({ className, variant = "soft", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "optical-center inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-500",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
