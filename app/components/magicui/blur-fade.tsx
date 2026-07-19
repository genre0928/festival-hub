import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "~/lib/utils";

interface BlurFadeProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}

export function BlurFade({ children, className, delay = 0, duration = 0.4 }: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-[opacity,filter,transform] ease-out",
        visible
          ? "translate-y-0 opacity-100 blur-0"
          : "translate-y-3 opacity-0 blur-sm",
        className,
      )}
      style={{
        transitionDuration: `${duration}s`,
        transitionDelay: `${delay}s`,
      }}
    >
      {children}
    </div>
  );
}
