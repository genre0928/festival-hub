import type { ReactNode } from "react";
import { SeasonProvider } from "~/components/season/season-provider";
import { SeasonalBackground } from "~/components/season/seasonal-background";
import { TextSizeProvider } from "~/components/settings/text-size-provider";
import { Navbar } from "~/components/layout/navbar";

// AuthProvider는 root.tsx에서 App 전체를 감싸도록 올라갔다 - AppLayout은 라우트 컴포넌트가
// 렌더하는 자식이라, 그 라우트 컴포넌트 자신이 useAuth()를 쓰려면(예: routes/home.tsx)
// Provider가 라우트보다 더 바깥(root)에 있어야 한다.
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <TextSizeProvider>
      <SeasonProvider>
        <div className="relative min-h-screen">
          <SeasonalBackground />
          <Navbar />
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </div>
      </SeasonProvider>
    </TextSizeProvider>
  );
}
