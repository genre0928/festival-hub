import { createClient } from "@supabase/supabase-js";
import type { Database } from "~/lib/supabase/types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * anon key만 사용하는 클라이언트 전용 Supabase 클라이언트.
 * .env에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY가 없으면 null을 반환하므로,
 * 실제 연동 전까지는 app/lib/festivals.ts의 mock 데이터 seam을 사용한다.
 */
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey)
    : null;
