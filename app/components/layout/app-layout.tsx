import type { ReactNode } from "react";
import { SeasonProvider } from "~/components/season/season-provider";
import { SeasonalBackground } from "~/components/season/seasonal-background";
import { Navbar } from "~/components/layout/navbar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SeasonProvider>
      <div className="relative min-h-screen">
        <SeasonalBackground />
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </div>
    </SeasonProvider>
  );
}
