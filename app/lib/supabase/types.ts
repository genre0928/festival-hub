export type RegionRow = {
  code: string;
  name: string;
  name_en: string | null;
  created_at: string;
};

export type FestivalRow = {
  id: string;
  name: string;
  description: string;
  region_code: string;
  sigungu: string | null;
  address: string;
  start_date: string;
  end_date: string;
  category: string;
  tags: string[];
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  source_url: string | null;
  external_id: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

export type FestivalStatusRow = "ongoing" | "upcoming" | "ended";

export type FestivalWithStatusRow = FestivalRow & {
  status: FestivalStatusRow;
};

export type SubscriberFrequency = "weekly" | "monthly";

/** 로그인한 사용자의 카카오톡 알림 구독 설정. RLS로 본인 행만 조회/수정 가능 */
export type SubscriberRow = {
  id: string;
  user_id: string;
  frequency: SubscriberFrequency;
  regions: string[];
  is_active: boolean;
  kakao_connected: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * 카카오 로그인으로 발급받은 talk_message 스코프 토큰.
 * RLS에 select 정책이 없어 클라이언트는 insert/update만 가능(값을 다시 읽을 수 없음).
 */
export type KakaoTokenRow = {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  updated_at: string;
};

/** 신규 감지된 축제 기록. notified_at이 null이면 아직 알림 미발송 */
export type FestivalNewDetectionRow = {
  id: string;
  festival_id: string;
  detected_at: string;
  notified_at: string | null;
};

export type PendingNewFestivalNotificationRow = FestivalRow & {
  detection_id: string;
  detected_at: string;
};

/**
 * supabase-js의 createClient<Database>()에 전달할 최소 스키마 타입.
 * @supabase/postgrest-js의 GenericTable/GenericSchema가 Relationships/Functions 필드를
 * 요구하므로(없으면 upsert() 등 일부 제네릭이 조용히 never로 무너짐) 빈 배열/객체로라도
 * 반드시 채워둔다. Row/Insert/Update는 `interface`가 아니라 `type`이어야 한다 —
 * interface는 암묵적 인덱스 시그니처가 없어 `X extends Record<string, unknown>` 같은
 * 제네릭 제약 검사(postgrest-js/supabase-js 내부)에서 항상 실패해 조용히 never로 무너진다.
 */
export type Database = {
  public: {
    Tables: {
      regions: {
        Row: RegionRow;
        Insert: Partial<RegionRow> & Pick<RegionRow, "code" | "name">;
        Update: Partial<RegionRow>;
        Relationships: [];
      };
      festivals: {
        Row: FestivalRow;
        Insert: Partial<FestivalRow> &
          Pick<FestivalRow, "name" | "region_code" | "start_date" | "end_date" | "category">;
        Update: Partial<FestivalRow>;
        Relationships: [];
      };
      subscribers: {
        Row: SubscriberRow;
        Insert: Partial<SubscriberRow> & Pick<SubscriberRow, "user_id">;
        Update: Partial<SubscriberRow>;
        Relationships: [];
      };
      kakao_tokens: {
        Row: KakaoTokenRow;
        Insert: Pick<KakaoTokenRow, "user_id" | "access_token" | "refresh_token" | "expires_at">;
        Update: Partial<KakaoTokenRow>;
        Relationships: [];
      };
      festival_new_detections: {
        Row: FestivalNewDetectionRow;
        Insert: Partial<FestivalNewDetectionRow> & Pick<FestivalNewDetectionRow, "festival_id">;
        Update: Partial<FestivalNewDetectionRow>;
        Relationships: [];
      };
    };
    Views: {
      festivals_with_status: {
        Row: FestivalWithStatusRow;
        Relationships: [];
      };
      pending_new_festival_notifications: {
        Row: PendingNewFestivalNotificationRow;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
}
