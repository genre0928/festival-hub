import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "~/lib/utils";

type ButtonVariant = "primary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-season-primary text-season-primary-foreground hover:opacity-90 shadow-sm",
  outline:
    "border border-season-border bg-season-surface text-season-surface-foreground hover:bg-season-secondary",
  ghost: "text-season-surface-foreground hover:bg-season-secondary",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "optical-center h-8 px-3 text-sm rounded-full",
  md: "optical-center h-10 px-4 text-sm rounded-full",
  icon: "h-9 w-9 rounded-full",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 font-medium transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-season-ring/60",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
