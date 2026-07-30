import { createClient } from "@supabase/supabase-js";
import type { Database } from "~/lib/supabase/types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * anon key만 사용하는 클라이언트 전용 Supabase 클라이언트.
 * .env에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY가 없으면 null을 반환하므로,
 * 실제 연동 전까지는 app/lib/festivals.ts의 mock 데이터 seam을 사용한다.
 */
// 브라우저에서만 생성한다 - SPA 모드(ssr:false)라도 dev 서버/prerender가 모듈을 평가하는
// 과정에서 Node(서버) 쪽에서 이 파일이 import될 수 있는데, Node 22 미만에는 전역 WebSocket이
// 없어 realtime-js 초기화가 그대로 죽는다. anon key만 쓰는 클라이언트 전용 인스턴스이므로
// 서버에서는 만들 이유도 없다.
export const supabase =
  typeof window !== "undefined" && supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey)
    : null;
