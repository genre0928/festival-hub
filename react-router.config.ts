import type { Config } from "@react-router/dev/config";

export default {
  // Supabase(anon key)만 사용하는 클라이언트 전용 앱이라 SPA 모드로 단순화.
  // 추후 SSR이 필요해지면 이 값을 true로 바꾸면 됨.
  ssr: false,
} satisfies Config;
