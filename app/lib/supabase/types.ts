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
  created_at: string;
  updated_at: string;
}

export type FestivalStatusRow = "ongoing" | "upcoming" | "ended";

export interface FestivalWithStatusRow extends FestivalRow {
  status: FestivalStatusRow;
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
    };
    Views: {
      festivals_with_status: {
        Row: FestivalWithStatusRow;
      };
    };
  };
}
