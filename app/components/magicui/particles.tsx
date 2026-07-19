import { useEffect, useRef } from "react";
import { cn } from "~/lib/utils";

interface ParticlesProps {
  className?: string;
  quantity?: number;
  colors?: string[];
  shape?: "circle" | "petal";
  minSize?: number;
  maxSize?: number;
  /** 초당 하강 속도(px) */
  fallSpeed?: number;
  /** 좌우로 흔들리는 폭(px) */
  sway?: number;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  drift: number;
  angle: number;
  spin: number;
  color: string;
  swayOffset: number;
}

export function Particles({
  className,
  quantity = 36,
  colors = ["#ffffff"],
  shape = "circle",
  minSize = 3,
  maxSize = 7,
  fallSpeed = 30,
  sway = 20,
}: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let animationFrame = 0;

    const makeParticle = (randomY = true): Particle => ({
      x: Math.random() * width,
      y: randomY ? Math.random() * height : -20,
      size: minSize + Math.random() * (maxSize - minSize),
      speed: fallSpeed * (0.6 + Math.random() * 0.8),
      drift: (Math.random() - 0.5) * sway,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      swayOffset: Math.random() * Math.PI * 2,
    });

    function resize() {
      const parent = canvas!.parentElement;
      width = parent ? parent.clientWidth : window.innerWidth;
      height = parent ? parent.clientHeight : window.innerHeight;
      canvas!.width = width * devicePixelRatio;
      canvas!.height = height * devicePixelRatio;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.scale(devicePixelRatio, devicePixelRatio);
      particles = Array.from({ length: quantity }, () => makeParticle(true));
    }

    function drawParticle(p: Particle) {
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.angle);
      ctx!.fillStyle = p.color;
      ctx!.globalAlpha = 0.85;
      if (shape === "petal") {
        ctx!.beginPath();
        ctx!.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
        ctx!.fill();
      } else {
        ctx!.beginPath();
        ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.restore();
    }

    let t = 0;
    function frame() {
      t += 1 / 60;
      ctx!.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.y += (p.speed / 60);
        p.x += Math.sin(t + p.swayOffset) * (p.drift / 30);
        p.angle += p.spin / 60;
        if (p.y > height + 20) {
          Object.assign(p, makeParticle(false));
        }
        drawParticle(p);
      }
      animationFrame = requestAnimationFrame(frame);
    }

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    if (prefersReducedMotion) {
      for (const p of particles) drawParticle(p);
    } else {
      animationFrame = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(animationFrame);
      ro.disconnect();
    };
  }, [quantity, colors, shape, minSize, maxSize, fallSpeed, sway]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("pointer-events-none absolute inset-0", className)}
      aria-hidden="true"
    />
  );
}
