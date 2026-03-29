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
      profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string | null;
          field: string | null;
          language_preference: "english" | "spanish" | "asl";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name?: string | null;
          field?: string | null;
          language_preference?: "english" | "spanish" | "asl";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string | null;
          field?: string | null;
          language_preference?: "english" | "spanish" | "asl";
          created_at?: string;
          updated_at?: string;
        };
      };
      resumes: {
        Row: {
          id: string;
          user_id: string;
          file_path: string;
          parsed_data: Json | null;
          detected_field: string | null;
          upload_date: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_path: string;
          parsed_data?: Json | null;
          detected_field?: string | null;
          upload_date?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          file_path?: string;
          parsed_data?: Json | null;
          detected_field?: string | null;
          upload_date?: string;
        };
      };
      interview_sessions: {
        Row: {
          id: string;
          user_id: string;
          session_date: string;
          questions: Json;
          answers: Json;
          feedback: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_date?: string;
          questions: Json;
          answers: Json;
          feedback?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_date?: string;
          questions?: Json;
          answers?: Json;
          feedback?: Json | null;
          created_at?: string;
        };
      };
    };
  };
}
