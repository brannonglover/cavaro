export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      cigar_catalog: {
        Row: {
          id: number;
          brand: string | null;
          name: string | null;
          line: string | null;
          description: string | null;
          wrapper: string | null;
          binder: string | null;
          filler: string | null;
          length: string | null;
          image: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          brand?: string | null;
          name?: string | null;
          line?: string | null;
          description?: string | null;
          wrapper?: string | null;
          binder?: string | null;
          filler?: string | null;
          length?: string | null;
          image?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          brand?: string | null;
          name?: string | null;
          line?: string | null;
          description?: string | null;
          wrapper?: string | null;
          binder?: string | null;
          filler?: string | null;
          length?: string | null;
          image?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
