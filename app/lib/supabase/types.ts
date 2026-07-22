export interface RegionRow {
  code: string;
  name: string;
  name_en: string | null;
  created_at: string;
}

export interface FestivalRow {
  id: string;
  name: string;
  description: string;
  region_code: string;
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
}

export type FestivalStatusRow = "ongoing" | "upcoming" | "ended";

export interface FestivalWithStatusRow extends FestivalRow {
  status: FestivalStatusRow;
}

export type SubscriberChannelType = "kakao_login" | "phone";
export type SubscriberFrequency = "weekly" | "monthly";

/** 카카오톡 알림 구독자. RLS로 anon 접근 차단, service_role(Edge Function)에서만 사용 */
export interface SubscriberRow {
  id: string;
  channel_type: SubscriberChannelType;
  channel_identifier: string;
  frequency: SubscriberFrequency;
  regions: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** 신규 감지된 축제 기록. notified_at이 null이면 아직 알림 미발송 */
export interface FestivalNewDetectionRow {
  id: string;
  festival_id: string;
  detected_at: string;
  notified_at: string | null;
}

export interface PendingNewFestivalNotificationRow extends FestivalRow {
  detection_id: string;
  detected_at: string;
}

/** supabase-js의 createClient<Database>()에 전달할 최소 스키마 타입 */
export interface Database {
  public: {
    Tables: {
      regions: {
        Row: RegionRow;
        Insert: Partial<RegionRow> & Pick<RegionRow, "code" | "name">;
        Update: Partial<RegionRow>;
      };
      festivals: {
        Row: FestivalRow;
        Insert: Partial<FestivalRow> &
          Pick<FestivalRow, "name" | "region_code" | "start_date" | "end_date" | "category">;
        Update: Partial<FestivalRow>;
      };
      subscribers: {
        Row: SubscriberRow;
        Insert: Partial<SubscriberRow> & Pick<SubscriberRow, "channel_type" | "channel_identifier">;
        Update: Partial<SubscriberRow>;
      };
      festival_new_detections: {
        Row: FestivalNewDetectionRow;
        Insert: Partial<FestivalNewDetectionRow> & Pick<FestivalNewDetectionRow, "festival_id">;
        Update: Partial<FestivalNewDetectionRow>;
      };
    };
    Views: {
      festivals_with_status: {
        Row: FestivalWithStatusRow;
      };
      pending_new_festival_notifications: {
        Row: PendingNewFestivalNotificationRow;
      };
    };
  };
}
