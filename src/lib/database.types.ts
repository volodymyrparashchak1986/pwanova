export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          id: string
          reason: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_ai_providers: {
        Row: {
          app_id: string
          created_at: string
          created_by: string | null
          id: string
          model_name: string | null
          provider: string
          purpose: string | null
          source_type: string
          source_url: string | null
          verified_at: string | null
        }
        Insert: {
          app_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          model_name?: string | null
          provider: string
          purpose?: string | null
          source_type?: string
          source_url?: string | null
          verified_at?: string | null
        }
        Update: {
          app_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          model_name?: string | null
          provider?: string
          purpose?: string | null
          source_type?: string
          source_url?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_ai_providers_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_ai_providers_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_ai_providers_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_ai_providers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_alternatives: {
        Row: {
          alternative_to_app_id: string | null
          alternative_to_name: string
          alternative_to_slug: string
          app_id: string
          created_at: string
          created_by: string | null
          source_type: string
          source_url: string | null
          verified_at: string | null
        }
        Insert: {
          alternative_to_app_id?: string | null
          alternative_to_name: string
          alternative_to_slug: string
          app_id: string
          created_at?: string
          created_by?: string | null
          source_type?: string
          source_url?: string | null
          verified_at?: string | null
        }
        Update: {
          alternative_to_app_id?: string | null
          alternative_to_name?: string
          alternative_to_slug?: string
          app_id?: string
          created_at?: string
          created_by?: string | null
          source_type?: string
          source_url?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_alternatives_alternative_to_app_id_fkey"
            columns: ["alternative_to_app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_alternatives_alternative_to_app_id_fkey"
            columns: ["alternative_to_app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_alternatives_alternative_to_app_id_fkey"
            columns: ["alternative_to_app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_alternatives_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_alternatives_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_alternatives_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_alternatives_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_categories: {
        Row: {
          app_id: string
          category_id: string
          created_at: string
          is_primary: boolean
        }
        Insert: {
          app_id: string
          category_id: string
          created_at?: string
          is_primary?: boolean
        }
        Update: {
          app_id?: string
          category_id?: string
          created_at?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "app_categories_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_categories_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_categories_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "app_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      app_checks: {
        Row: {
          app_id: string
          details: Json
          https_ok: boolean | null
          id: string
          installable: boolean | null
          last_checked_at: string
          manifest_ok: boolean | null
          mobile_optimized: boolean | null
          offline_support: boolean | null
          push_support: boolean | null
          reachable: boolean | null
          response_ms: number | null
          responsive: boolean | null
          security_ok: boolean | null
          service_worker_ok: boolean | null
          status_code: number | null
        }
        Insert: {
          app_id: string
          details?: Json
          https_ok?: boolean | null
          id?: string
          installable?: boolean | null
          last_checked_at?: string
          manifest_ok?: boolean | null
          mobile_optimized?: boolean | null
          offline_support?: boolean | null
          push_support?: boolean | null
          reachable?: boolean | null
          response_ms?: number | null
          responsive?: boolean | null
          security_ok?: boolean | null
          service_worker_ok?: boolean | null
          status_code?: number | null
        }
        Update: {
          app_id?: string
          details?: Json
          https_ok?: boolean | null
          id?: string
          installable?: boolean | null
          last_checked_at?: string
          manifest_ok?: boolean | null
          mobile_optimized?: boolean | null
          offline_support?: boolean | null
          push_support?: boolean | null
          reachable?: boolean | null
          response_ms?: number | null
          responsive?: boolean | null
          security_ok?: boolean | null
          service_worker_ok?: boolean | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "app_checks_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: true
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_checks_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: true
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_checks_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: true
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      app_claims: {
        Row: {
          app_id: string
          bound_url: string
          created_at: string
          expires_at: string
          id: string
          last_error: string | null
          method: string | null
          status: string
          token: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          app_id: string
          bound_url: string
          created_at?: string
          expires_at?: string
          id?: string
          last_error?: string | null
          method?: string | null
          status?: string
          token?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          app_id?: string
          bound_url?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_error?: string | null
          method?: string | null
          status?: string
          token?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_claims_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_claims_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_claims_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_data_locations: {
        Row: {
          app_id: string
          country_code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean
          region: string
          source_type: string
          source_url: string | null
          verified_at: string | null
        }
        Insert: {
          app_id: string
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          region: string
          source_type?: string
          source_url?: string | null
          verified_at?: string | null
        }
        Update: {
          app_id?: string
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          region?: string
          source_type?: string
          source_url?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_data_locations_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_data_locations_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_data_locations_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_data_locations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_events: {
        Row: {
          app_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          partner_id: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          app_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          partner_id?: string | null
          source?: string
          user_id?: string | null
        }
        Update: {
          app_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          partner_id?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_events_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_events_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_events_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_events_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_evidence: {
        Row: {
          app_id: string
          attribute_key: string
          collected_at: string
          confidence: number | null
          confirmations: number
          created_at: string
          evidence_excerpt: string | null
          id: string
          last_confirmed_at: string | null
          review_note: string | null
          run_id: string | null
          source_title: string | null
          source_type: string
          source_url: string | null
          status: string
          submitted_by: string | null
          superseded_at: string | null
          superseded_by: string | null
          value_json: Json
          value_state: string
          value_text: string | null
          verification_method: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          app_id: string
          attribute_key: string
          collected_at?: string
          confidence?: number | null
          confirmations?: number
          created_at?: string
          evidence_excerpt?: string | null
          id?: string
          last_confirmed_at?: string | null
          review_note?: string | null
          run_id?: string | null
          source_title?: string | null
          source_type: string
          source_url?: string | null
          status?: string
          submitted_by?: string | null
          superseded_at?: string | null
          superseded_by?: string | null
          value_json?: Json
          value_state: string
          value_text?: string | null
          verification_method: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          app_id?: string
          attribute_key?: string
          collected_at?: string
          confidence?: number | null
          confirmations?: number
          created_at?: string
          evidence_excerpt?: string | null
          id?: string
          last_confirmed_at?: string | null
          review_note?: string | null
          run_id?: string | null
          source_title?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          submitted_by?: string | null
          superseded_at?: string | null
          superseded_by?: string | null
          value_json?: Json
          value_state?: string
          value_text?: string | null
          verification_method?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_evidence_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_evidence_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_evidence_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_evidence_attribute_key_fkey"
            columns: ["attribute_key"]
            isOneToOne: false
            referencedRelation: "fact_attributes"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "app_evidence_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "verification_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_evidence_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_evidence_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "app_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_evidence_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_facts: {
        Row: {
          app_id: string
          attribute_key: string
          effective_source: string | null
          effective_state: string | null
          last_attempt_at: string | null
          last_attempt_outcome: string | null
          updated_at: string
          vendor_evidence_id: string | null
          vendor_source_url: string | null
          vendor_state: string
          vendor_stated_at: string | null
          vendor_value: string | null
          verified_at: string | null
          verified_evidence_id: string | null
          verified_source_type: string | null
          verified_source_url: string | null
          verified_state: string
          verified_value: string | null
        }
        Insert: {
          app_id: string
          attribute_key: string
          effective_source?: string | null
          effective_state?: string | null
          last_attempt_at?: string | null
          last_attempt_outcome?: string | null
          updated_at?: string
          vendor_evidence_id?: string | null
          vendor_source_url?: string | null
          vendor_state?: string
          vendor_stated_at?: string | null
          vendor_value?: string | null
          verified_at?: string | null
          verified_evidence_id?: string | null
          verified_source_type?: string | null
          verified_source_url?: string | null
          verified_state?: string
          verified_value?: string | null
        }
        Update: {
          app_id?: string
          attribute_key?: string
          effective_source?: string | null
          effective_state?: string | null
          last_attempt_at?: string | null
          last_attempt_outcome?: string | null
          updated_at?: string
          vendor_evidence_id?: string | null
          vendor_source_url?: string | null
          vendor_state?: string
          vendor_stated_at?: string | null
          vendor_value?: string | null
          verified_at?: string | null
          verified_evidence_id?: string | null
          verified_source_type?: string | null
          verified_source_url?: string | null
          verified_state?: string
          verified_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_facts_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_facts_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_facts_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_facts_attribute_key_fkey"
            columns: ["attribute_key"]
            isOneToOne: false
            referencedRelation: "fact_attributes"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "app_facts_vendor_evidence_id_fkey"
            columns: ["vendor_evidence_id"]
            isOneToOne: false
            referencedRelation: "app_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_facts_verified_evidence_id_fkey"
            columns: ["verified_evidence_id"]
            isOneToOne: false
            referencedRelation: "app_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      app_integrations: {
        Row: {
          app_id: string
          created_at: string
          created_by: string | null
          integration_id: string
          source_type: string
          source_url: string | null
          verified_at: string | null
        }
        Insert: {
          app_id: string
          created_at?: string
          created_by?: string | null
          integration_id: string
          source_type?: string
          source_url?: string | null
          verified_at?: string | null
        }
        Update: {
          app_id?: string
          created_at?: string
          created_by?: string | null
          integration_id?: string
          source_type?: string
          source_url?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_integrations_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_integrations_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_integrations_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_integrations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_integrations_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integration_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      app_languages: {
        Row: {
          app_id: string
          created_at: string
          created_by: string | null
          language_code: string
          source_type: string
          source_url: string | null
          verified_at: string | null
        }
        Insert: {
          app_id: string
          created_at?: string
          created_by?: string | null
          language_code: string
          source_type?: string
          source_url?: string | null
          verified_at?: string | null
        }
        Update: {
          app_id?: string
          created_at?: string
          created_by?: string | null
          language_code?: string
          source_type?: string
          source_url?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_languages_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_languages_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_languages_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_languages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_platforms: {
        Row: {
          app_id: string
          created_at: string
          created_by: string | null
          platform: string
          source_type: string
          source_url: string | null
          verified_at: string | null
        }
        Insert: {
          app_id: string
          created_at?: string
          created_by?: string | null
          platform: string
          source_type?: string
          source_url?: string | null
          verified_at?: string | null
        }
        Update: {
          app_id?: string
          created_at?: string
          created_by?: string | null
          platform?: string
          source_type?: string
          source_url?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_platforms_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_platforms_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_platforms_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_platforms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_screenshots: {
        Row: {
          app_id: string
          id: string
          image_url: string
          sort_order: number
        }
        Insert: {
          app_id: string
          id?: string
          image_url: string
          sort_order?: number
        }
        Update: {
          app_id?: string
          id?: string
          image_url?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "app_screenshots_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_screenshots_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_screenshots_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      app_sources: {
        Row: {
          app_id: string
          created_at: string
          id: string
          partner_id: string | null
          source_name: string
          source_type: string
          source_url: string | null
        }
        Insert: {
          app_id: string
          created_at?: string
          id?: string
          partner_id?: string | null
          source_name: string
          source_type?: string
          source_url?: string | null
        }
        Update: {
          app_id?: string
          created_at?: string
          id?: string
          partner_id?: string | null
          source_name?: string
          source_type?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_sources_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_sources_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_sources_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_sources_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      app_subprocessors: {
        Row: {
          app_id: string
          country_code: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          purpose: string | null
          source_type: string
          source_url: string | null
          verified_at: string | null
        }
        Insert: {
          app_id: string
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          purpose?: string | null
          source_type?: string
          source_url?: string | null
          verified_at?: string | null
        }
        Update: {
          app_id?: string
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          purpose?: string | null
          source_type?: string
          source_url?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_subprocessors_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_subprocessors_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_subprocessors_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_subprocessors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_translations: {
        Row: {
          app_id: string
          description: string | null
          locale: string
          source: string
          tagline: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          app_id: string
          description?: string | null
          locale: string
          source?: string
          tagline?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          app_id?: string
          description?: string | null
          locale?: string
          source?: string
          tagline?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_translations_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_translations_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_translations_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_translations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_updates: {
        Row: {
          app_id: string
          author_id: string | null
          body: string | null
          created_at: string
          id: string
          kind: string
          link_url: string | null
          moderation_note: string | null
          published_at: string | null
          status: string
          title: string
          updated_at: string
          version: string | null
        }
        Insert: {
          app_id: string
          author_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link_url?: string | null
          moderation_note?: string | null
          published_at?: string | null
          status?: string
          title: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          app_id?: string
          author_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link_url?: string | null
          moderation_note?: string | null
          published_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_updates_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_updates_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_updates_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_use_cases: {
        Row: {
          app_id: string
          created_at: string
          use_case_id: string
        }
        Insert: {
          app_id: string
          created_at?: string
          use_case_id: string
        }
        Update: {
          app_id?: string
          created_at?: string
          use_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_use_cases_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_use_cases_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_use_cases_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_use_cases_use_case_id_fkey"
            columns: ["use_case_id"]
            isOneToOne: false
            referencedRelation: "use_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      apps: {
        Row: {
          aliases: string[]
          build_tool: string
          category: string
          company_id: string | null
          content_locale: string
          created_at: string
          description: string | null
          developer_id: string | null
          domain: string
          duplicate_of: string | null
          evidence_checked_at: string | null
          evidence_score: number
          featured_at: string | null
          founded_year: number | null
          has_free_plan: boolean | null
          has_free_trial: boolean | null
          health_checked_at: string | null
          health_status: string
          hosting_provider: string
          icon_url: string | null
          id: string
          is_demo: boolean
          is_featured: boolean
          is_installable: boolean
          is_pwa: boolean
          moderation_hidden: boolean
          moderation_note: string | null
          name: string
          next_check_at: string | null
          ownership_method: string | null
          ownership_status: string
          ownership_verified_at: string | null
          price_currency: string | null
          pricing_model: string
          primary_category_id: string | null
          profile_completeness: number
          search_text: string | null
          search_vector: unknown
          slug: string
          starting_price_cents: number | null
          status: string
          tagline: string | null
          updated_at: string
          url: string
          verification_state: string
          verification_status: string
        }
        Insert: {
          aliases?: string[]
          build_tool?: string
          category?: string
          company_id?: string | null
          content_locale?: string
          created_at?: string
          description?: string | null
          developer_id?: string | null
          domain: string
          duplicate_of?: string | null
          evidence_checked_at?: string | null
          evidence_score?: number
          featured_at?: string | null
          founded_year?: number | null
          has_free_plan?: boolean | null
          has_free_trial?: boolean | null
          health_checked_at?: string | null
          health_status?: string
          hosting_provider?: string
          icon_url?: string | null
          id?: string
          is_demo?: boolean
          is_featured?: boolean
          is_installable?: boolean
          is_pwa?: boolean
          moderation_hidden?: boolean
          moderation_note?: string | null
          name: string
          next_check_at?: string | null
          ownership_method?: string | null
          ownership_status?: string
          ownership_verified_at?: string | null
          price_currency?: string | null
          pricing_model?: string
          primary_category_id?: string | null
          profile_completeness?: number
          search_text?: string | null
          search_vector?: unknown
          slug: string
          starting_price_cents?: number | null
          status?: string
          tagline?: string | null
          updated_at?: string
          url: string
          verification_state?: string
          verification_status?: string
        }
        Update: {
          aliases?: string[]
          build_tool?: string
          category?: string
          company_id?: string | null
          content_locale?: string
          created_at?: string
          description?: string | null
          developer_id?: string | null
          domain?: string
          duplicate_of?: string | null
          evidence_checked_at?: string | null
          evidence_score?: number
          featured_at?: string | null
          founded_year?: number | null
          has_free_plan?: boolean | null
          has_free_trial?: boolean | null
          health_checked_at?: string | null
          health_status?: string
          hosting_provider?: string
          icon_url?: string | null
          id?: string
          is_demo?: boolean
          is_featured?: boolean
          is_installable?: boolean
          is_pwa?: boolean
          moderation_hidden?: boolean
          moderation_note?: string | null
          name?: string
          next_check_at?: string | null
          ownership_method?: string | null
          ownership_status?: string
          ownership_verified_at?: string | null
          price_currency?: string | null
          pricing_model?: string
          primary_category_id?: string | null
          profile_completeness?: number
          search_text?: string | null
          search_vector?: unknown
          slug?: string
          starting_price_cents?: number | null
          status?: string
          tagline?: string | null
          updated_at?: string
          url?: string
          verification_state?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "apps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "apps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apps_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apps_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apps_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apps_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apps_primary_category_id_fkey"
            columns: ["primary_category_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "apps_primary_category_id_fkey"
            columns: ["primary_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          app_id: string | null
          created_at: string
          id: string
          next: Json | null
          previous: Json | null
          reason: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          app_id?: string | null
          created_at?: string
          id?: string
          next?: Json | null
          previous?: Json | null
          reason?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          app_id?: string | null
          created_at?: string
          id?: string
          next?: Json | null
          previous?: Json | null
          reason?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_contact_consents: {
        Row: {
          consent_text: string
          granted_at: string
          granted_by: string
          id: string
          request_id: string
          response_id: string
          revoked_at: string | null
          shared_fields: string[]
        }
        Insert: {
          consent_text: string
          granted_at?: string
          granted_by: string
          id?: string
          request_id: string
          response_id: string
          revoked_at?: string | null
          shared_fields: string[]
        }
        Update: {
          consent_text?: string
          granted_at?: string
          granted_by?: string
          id?: string
          request_id?: string
          response_id?: string
          revoked_at?: string | null
          shared_fields?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "buyer_contact_consents_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_contact_consents_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "buyer_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_contact_consents_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: true
            referencedRelation: "buyer_request_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_request_contacts: {
        Row: {
          company_name: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          note: string | null
          phone: string | null
          request_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          note?: string | null
          phone?: string | null
          request_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          note?: string | null
          phone?: string | null
          request_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_request_contacts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "buyer_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_request_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_request_matches: {
        Row: {
          app_id: string
          created_at: string
          rank: number
          reasons: Json
          request_id: string
          score: number
        }
        Insert: {
          app_id: string
          created_at?: string
          rank: number
          reasons?: Json
          request_id: string
          score: number
        }
        Update: {
          app_id?: string
          created_at?: string
          rank?: number
          reasons?: Json
          request_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "buyer_request_matches_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_request_matches_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_request_matches_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_request_matches_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "buyer_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_request_responses: {
        Row: {
          app_id: string
          created_at: string
          id: string
          message: string | null
          request_id: string
          status: string
          updated_at: string
          vendor_user_id: string
        }
        Insert: {
          app_id: string
          created_at?: string
          id?: string
          message?: string | null
          request_id: string
          status?: string
          updated_at?: string
          vendor_user_id: string
        }
        Update: {
          app_id?: string
          created_at?: string
          id?: string
          message?: string | null
          request_id?: string
          status?: string
          updated_at?: string
          vendor_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_request_responses_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_request_responses_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_request_responses_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_request_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "buyer_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_request_responses_vendor_user_id_fkey"
            columns: ["vendor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_requests: {
        Row: {
          budget_currency: string
          budget_interval: string | null
          budget_max_cents: number | null
          budget_per_user: boolean
          category_slugs: string[]
          country_code: string | null
          created_at: string
          id: string
          languages: string[]
          locale: string
          moderation_note: string | null
          must_have: string[]
          nice_to_have: string[]
          problem: string
          public_id: string
          required_facts: string[]
          required_integrations: string[]
          required_platforms: string[]
          status: string
          team_size: string | null
          timeframe: string | null
          title: string
          updated_at: string
          use_case_slugs: string[]
          user_id: string
          visibility: string
        }
        Insert: {
          budget_currency?: string
          budget_interval?: string | null
          budget_max_cents?: number | null
          budget_per_user?: boolean
          category_slugs?: string[]
          country_code?: string | null
          created_at?: string
          id?: string
          languages?: string[]
          locale?: string
          moderation_note?: string | null
          must_have?: string[]
          nice_to_have?: string[]
          problem: string
          public_id?: string
          required_facts?: string[]
          required_integrations?: string[]
          required_platforms?: string[]
          status?: string
          team_size?: string | null
          timeframe?: string | null
          title: string
          updated_at?: string
          use_case_slugs?: string[]
          user_id: string
          visibility?: string
        }
        Update: {
          budget_currency?: string
          budget_interval?: string | null
          budget_max_cents?: number | null
          budget_per_user?: boolean
          category_slugs?: string[]
          country_code?: string | null
          created_at?: string
          id?: string
          languages?: string[]
          locale?: string
          moderation_note?: string | null
          must_have?: string[]
          nice_to_have?: string[]
          problem?: string
          public_id?: string
          required_facts?: string[]
          required_integrations?: string[]
          required_platforms?: string[]
          status?: string
          team_size?: string | null
          timeframe?: string | null
          title?: string
          updated_at?: string
          use_case_slugs?: string[]
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: Json
          icon: string | null
          id: string
          is_active: boolean
          legacy_keys: string[]
          name: Json
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: Json
          icon?: string | null
          id?: string
          is_active?: boolean
          legacy_keys?: string[]
          name: Json
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: Json
          icon?: string | null
          id?: string
          is_active?: boolean
          legacy_keys?: string[]
          name?: Json
          parent_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_follows: {
        Row: {
          category_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_follows_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "category_follows_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          city: string | null
          contact_url: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          founded_year: number | null
          id: string
          legal_name: string | null
          legal_url: string | null
          name: string
          slug: string
          source_type: string
          source_url: string | null
          updated_at: string
          verified_at: string | null
          website: string | null
        }
        Insert: {
          city?: string | null
          contact_url?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          founded_year?: number | null
          id?: string
          legal_name?: string | null
          legal_url?: string | null
          name: string
          slug: string
          source_type?: string
          source_url?: string | null
          updated_at?: string
          verified_at?: string | null
          website?: string | null
        }
        Update: {
          city?: string | null
          contact_url?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          founded_year?: number | null
          id?: string
          legal_name?: string | null
          legal_url?: string | null
          name?: string
          slug?: string
          source_type?: string
          source_url?: string | null
          updated_at?: string
          verified_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comparison_apps: {
        Row: {
          app_id: string
          comparison_id: string
          position: number
        }
        Insert: {
          app_id: string
          comparison_id: string
          position: number
        }
        Update: {
          app_id?: string
          comparison_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "comparison_apps_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparison_apps_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparison_apps_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparison_apps_comparison_id_fkey"
            columns: ["comparison_id"]
            isOneToOne: false
            referencedRelation: "comparisons"
            referencedColumns: ["id"]
          },
        ]
      }
      comparisons: {
        Row: {
          created_at: string
          id: string
          slug_key: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          slug_key: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          slug_key?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comparisons_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_responses: {
        Row: {
          body: string
          created_at: string
          developer_id: string
          id: string
          review_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          developer_id: string
          id?: string
          review_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          developer_id?: string
          id?: string
          review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_responses_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_responses_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlements: {
        Row: {
          app_id: string | null
          billing_reference: string | null
          created_at: string
          ends_at: string | null
          granted_by: string | null
          id: string
          note: string | null
          plan_slug: string
          starts_at: string
          status: string
          user_id: string
        }
        Insert: {
          app_id?: string | null
          billing_reference?: string | null
          created_at?: string
          ends_at?: string | null
          granted_by?: string | null
          id?: string
          note?: string | null
          plan_slug: string
          starts_at?: string
          status?: string
          user_id: string
        }
        Update: {
          app_id?: string | null
          billing_reference?: string | null
          created_at?: string
          ends_at?: string | null
          granted_by?: string | null
          id?: string
          note?: string | null
          plan_slug?: string
          starts_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_plan_slug_fkey"
            columns: ["plan_slug"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "entitlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fact_attributes: {
        Row: {
          auto_checkable: boolean
          description: Json
          dimension: string
          is_card_signal: boolean
          is_expected: boolean
          is_filterable: boolean
          key: string
          label: Json
          negative_label: Json
          positive_label: Json
          sort_order: number
          ttl_days: number
          value_type: string
          weight: number
        }
        Insert: {
          auto_checkable?: boolean
          description?: Json
          dimension: string
          is_card_signal?: boolean
          is_expected?: boolean
          is_filterable?: boolean
          key: string
          label: Json
          negative_label?: Json
          positive_label?: Json
          sort_order?: number
          ttl_days?: number
          value_type: string
          weight?: number
        }
        Update: {
          auto_checkable?: boolean
          description?: Json
          dimension?: string
          is_card_signal?: boolean
          is_expected?: boolean
          is_filterable?: boolean
          key?: string
          label?: Json
          negative_label?: Json
          positive_label?: Json
          sort_order?: number
          ttl_days?: number
          value_type?: string
          weight?: number
        }
        Relationships: []
      }
      favorites: {
        Row: {
          app_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          app_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          app_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          app_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          app_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          app_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_catalog: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          website?: string | null
        }
        Relationships: []
      }
      launches: {
        Row: {
          app_id: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          description: string | null
          description_de: string | null
          headline: string
          headline_de: string | null
          id: string
          is_sponsored: boolean
          launch_date: string
          moderation_note: string | null
          slug: string
          status: string
          submitted_by: string | null
          updated_at: string
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          app_id: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          description_de?: string | null
          headline: string
          headline_de?: string | null
          id?: string
          is_sponsored?: boolean
          launch_date?: string
          moderation_note?: string | null
          slug: string
          status?: string
          submitted_by?: string | null
          updated_at?: string
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          app_id?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          description_de?: string | null
          headline?: string
          headline_de?: string | null
          id?: string
          is_sponsored?: boolean
          launch_date?: string
          moderation_note?: string | null
          slug?: string
          status?: string
          submitted_by?: string | null
          updated_at?: string
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "launches_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launches_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launches_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launches_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launches_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscriptions: {
        Row: {
          confirmed_at: string | null
          consent_at: string
          consent_source: string
          consent_text: string
          created_at: string
          email: string
          id: string
          locale: string
          unsubscribe_token: string
          unsubscribed_at: string | null
          user_id: string | null
        }
        Insert: {
          confirmed_at?: string | null
          consent_at?: string
          consent_source: string
          consent_text: string
          created_at?: string
          email: string
          id?: string
          locale?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          user_id?: string | null
        }
        Update: {
          confirmed_at?: string | null
          consent_at?: string
          consent_source?: string
          consent_text?: string
          created_at?: string
          email?: string
          id?: string
          locale?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          app_id: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          metadata: Json
          read_at: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          app_id?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          app_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_members: {
        Row: {
          partner_id: string
          user_id: string
        }
        Insert: {
          partner_id: string
          user_id: string
        }
        Update: {
          partner_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_members_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_referrals: {
        Row: {
          app_id: string | null
          created_at: string
          developer_id: string
          id: string
          partner_id: string
        }
        Insert: {
          app_id?: string | null
          created_at?: string
          developer_id: string
          id?: string
          partner_id: string
        }
        Update: {
          app_id?: string | null
          created_at?: string
          developer_id?: string
          id?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_referrals_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referrals_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referrals_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referrals_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referrals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          logo_url: string | null
          name: string
          referral_code: string
          slug: string
          status: string
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          logo_url?: string | null
          name: string
          referral_code: string
          slug: string
          status?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          logo_url?: string | null
          name?: string
          referral_code?: string
          slug?: string
          status?: string
          website?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          audience: string
          billing_interval: string
          currency: string
          entitlements: string[]
          features: Json
          is_available: boolean
          is_public: boolean
          name: Json
          price_cents: number
          price_is_approximate: boolean
          slug: string
          sort_order: number
          summary: Json
          updated_at: string
        }
        Insert: {
          audience: string
          billing_interval: string
          currency?: string
          entitlements?: string[]
          features?: Json
          is_available?: boolean
          is_public?: boolean
          name: Json
          price_cents?: number
          price_is_approximate?: boolean
          slug: string
          sort_order?: number
          summary?: Json
          updated_at?: string
        }
        Update: {
          audience?: string
          billing_interval?: string
          currency?: string
          entitlements?: string[]
          features?: Json
          is_available?: boolean
          is_public?: boolean
          name?: Json
          price_cents?: number
          price_is_approximate?: boolean
          slug?: string
          sort_order?: number
          summary?: Json
          updated_at?: string
        }
        Relationships: []
      }
      pricing_plans: {
        Row: {
          app_id: string
          billing_interval: string
          created_at: string
          created_by: string | null
          currency: string | null
          description: string | null
          id: string
          name: string
          per_user: boolean
          price_cents: number | null
          sort_order: number
          source_type: string
          source_url: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          app_id: string
          billing_interval: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          name: string
          per_user?: boolean
          price_cents?: number | null
          sort_order?: number
          source_type?: string
          source_url?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          app_id?: string
          billing_interval?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          name?: string
          per_user?: boolean
          price_cents?: number | null
          sort_order?: number
          source_type?: string
          source_url?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_plans_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_plans_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_plans_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          is_demo: boolean
          is_verified: boolean
          locale: string | null
          role: string
          username: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_demo?: boolean
          is_verified?: boolean
          locale?: string | null
          role?: string
          username: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_demo?: boolean
          is_verified?: boolean
          locale?: string | null
          role?: string
          username?: string
          website?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          app_id: string
          created_at: string
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          app_id: string
          created_at?: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          app_id?: string
          created_at?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          app_id: string | null
          created_at: string
          details: string | null
          evidence_id: string | null
          id: string
          launch_id: string | null
          reason: string
          request_id: string | null
          review_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          app_id?: string | null
          created_at?: string
          details?: string | null
          evidence_id?: string | null
          id?: string
          launch_id?: string | null
          reason: string
          request_id?: string | null
          review_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          app_id?: string | null
          created_at?: string
          details?: string | null
          evidence_id?: string | null
          id?: string
          launch_id?: string | null
          reason?: string
          request_id?: string | null
          review_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "app_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_launch_id_fkey"
            columns: ["launch_id"]
            isOneToOne: false
            referencedRelation: "launch_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_launch_id_fkey"
            columns: ["launch_id"]
            isOneToOne: false
            referencedRelation: "launches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "buyer_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_helpful: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_helpful_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_helpful_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          app_id: string
          body: string
          created_at: string
          helpful_count: number
          hidden_at: string | null
          id: string
          is_demo: boolean
          moderation_reason: string | null
          rating: number | null
          status: string
          title: string | null
          updated_at: string
          user_id: string
          verified_usage: boolean
          verified_user: boolean
        }
        Insert: {
          app_id: string
          body: string
          created_at?: string
          helpful_count?: number
          hidden_at?: string | null
          id?: string
          is_demo?: boolean
          moderation_reason?: string | null
          rating?: number | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
          verified_usage?: boolean
          verified_user?: boolean
        }
        Update: {
          app_id?: string
          body?: string
          created_at?: string
          helpful_count?: number
          hidden_at?: string | null
          id?: string
          is_demo?: boolean
          moderation_reason?: string | null
          rating?: number | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          verified_usage?: boolean
          verified_user?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reviews_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          description: string | null
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_campaigns: {
        Row: {
          app_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          headline: Json
          id: string
          locale: string | null
          placement: string
          sponsor_name: string
          starts_at: string
          status: string
          target_url: string | null
          updated_at: string
        }
        Insert: {
          app_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          headline?: Json
          id?: string
          locale?: string | null
          placement: string
          sponsor_name: string
          starts_at: string
          status?: string
          target_url?: string | null
          updated_at?: string
        }
        Update: {
          app_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          headline?: Json
          id?: string
          locale?: string | null
          placement?: string
          sponsor_name?: string
          starts_at?: string
          status?: string
          target_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_campaigns_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_campaigns_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_campaigns_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_campaigns_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "sponsor_campaigns_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      use_cases: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: Json
          slug: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: Json
          slug: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: Json
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "use_cases_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "use_cases_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_results: {
        Row: {
          app_id: string
          attribute_key: string | null
          check_key: string
          checked_at: string
          detail: Json
          evidence_id: string | null
          http_status: number | null
          id: string
          outcome: string
          run_id: string
          source_url: string | null
          value_state: string | null
          value_text: string | null
        }
        Insert: {
          app_id: string
          attribute_key?: string | null
          check_key: string
          checked_at?: string
          detail?: Json
          evidence_id?: string | null
          http_status?: number | null
          id?: string
          outcome: string
          run_id: string
          source_url?: string | null
          value_state?: string | null
          value_text?: string | null
        }
        Update: {
          app_id?: string
          attribute_key?: string | null
          check_key?: string
          checked_at?: string
          detail?: Json
          evidence_id?: string | null
          http_status?: number | null
          id?: string
          outcome?: string
          run_id?: string
          source_url?: string | null
          value_state?: string | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_results_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_results_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_results_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_results_attribute_key_fkey"
            columns: ["attribute_key"]
            isOneToOne: false
            referencedRelation: "fact_attributes"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "verification_results_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "app_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "verification_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_runs: {
        Row: {
          app_id: string
          checked_url: string | null
          completed_at: string | null
          created_at: string
          error_summary: string | null
          id: string
          initiated_by: string | null
          result_summary: Json
          run_type: string
          started_at: string
          status: string
        }
        Insert: {
          app_id: string
          checked_url?: string | null
          completed_at?: string | null
          created_at?: string
          error_summary?: string | null
          id?: string
          initiated_by?: string | null
          result_summary?: Json
          run_type: string
          started_at?: string
          status?: string
        }
        Update: {
          app_id?: string
          checked_url?: string | null
          completed_at?: string | null
          created_at?: string
          error_summary?: string | null
          id?: string
          initiated_by?: string | null
          result_summary?: Json
          run_type?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_runs_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_runs_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_runs_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_runs_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      apps_public: {
        Row: {
          build_tool: string | null
          canonical_url: string | null
          category: string | null
          check_details: Json | null
          check_installable: boolean | null
          created_at: string | null
          description: string | null
          developer_avatar: string | null
          developer_id: string | null
          developer_name: string | null
          developer_username: string | null
          developer_verified: boolean | null
          domain: string | null
          favorites_7d: number | null
          favorites_count: number | null
          featured_at: string | null
          health_checked_at: string | null
          health_status: string | null
          hosting_provider: string | null
          https_ok: boolean | null
          icon_url: string | null
          id: string | null
          install_actions: number | null
          is_demo: boolean | null
          is_featured: boolean | null
          is_installable: boolean | null
          is_pwa: boolean | null
          last_checked_at: string | null
          launch_partner_slug: string | null
          launch_source_name: string | null
          launch_source_type: string | null
          launch_source_url: string | null
          manifest_ok: boolean | null
          mobile_optimized: boolean | null
          name: string | null
          offline_support: boolean | null
          opens_30d: number | null
          opens_7d: number | null
          ownership_method: string | null
          ownership_status: string | null
          ownership_verified_at: string | null
          push_support: boolean | null
          quality_passed: number | null
          ranking_score: number | null
          rating: number | null
          ratings_7d: number | null
          ratings_count: number | null
          reachable: boolean | null
          responsive: boolean | null
          reviews_7d: number | null
          reviews_count: number | null
          search_text: string | null
          security_ok: boolean | null
          service_worker_ok: boolean | null
          slug: string | null
          status: string | null
          tagline: string | null
          trending_score: number | null
          updated_at: string | null
          url: string | null
          verification_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apps_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_apps: {
        Row: {
          aliases: string[] | null
          build_tool: string | null
          category: string | null
          category_id: string | null
          category_name: Json | null
          category_slug: string | null
          category_slugs: string[] | null
          company_country: string | null
          company_id: string | null
          company_in_eu: boolean | null
          company_name: string | null
          company_slug: string | null
          company_source_type: string | null
          content_locale: string | null
          created_at: string | null
          description: string | null
          description_de: string | null
          developer_avatar: string | null
          developer_id: string | null
          developer_name: string | null
          developer_username: string | null
          domain: string | null
          evidence_checked_at: string | null
          evidence_score: number | null
          facts: Json | null
          facts_verified_yes: string[] | null
          facts_yes: string[] | null
          favorites_count: number | null
          featured_at: string | null
          followers_count: number | null
          has_free_plan: boolean | null
          has_free_trial: boolean | null
          health_checked_at: string | null
          health_status: string | null
          hosting_provider: string | null
          icon_url: string | null
          id: string | null
          install_actions: number | null
          integrations: string[] | null
          is_demo: boolean | null
          is_featured: boolean | null
          is_pwa: boolean | null
          languages: string[] | null
          launch_source_name: string | null
          launch_source_type: string | null
          launch_source_url: string | null
          name: string | null
          opens_30d: number | null
          opens_7d: number | null
          organic_score: number | null
          ownership_method: string | null
          ownership_status: string | null
          ownership_verified_at: string | null
          platforms: string[] | null
          price_currency: string | null
          pricing_model: string | null
          profile_completeness: number | null
          ranking_score: number | null
          rating: number | null
          ratings_count: number | null
          reviews_count: number | null
          search_norm: string | null
          search_vector: unknown
          slug: string | null
          starting_price_cents: number | null
          status: string | null
          tagline: string | null
          tagline_de: string | null
          trending_score: number | null
          updated_at: string | null
          updates_count: number | null
          url: string | null
          use_cases: string[] | null
          verification_state: string | null
          weighted_rating: number | null
        }
        Relationships: [
          {
            foreignKeyName: "apps_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_board: {
        Row: {
          app_icon_url: string | null
          app_id: string | null
          app_name: string | null
          app_slug: string | null
          app_tagline: string | null
          created_at: string | null
          description: string | null
          description_de: string | null
          evidence_score: number | null
          follows: number | null
          headline: string | null
          headline_de: string | null
          id: string | null
          in_window: boolean | null
          is_demo: boolean | null
          is_sponsored: boolean | null
          launch_date: string | null
          launch_score: number | null
          maker_name: string | null
          maker_username: string | null
          profile_completeness: number | null
          reviews: number | null
          saves: number | null
          slug: string | null
          status: string | null
          verification_state: string | null
          visitors: number | null
          window_end: string | null
          window_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "launches_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launches_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launches_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "catalog_apps"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_set_fact: {
        Args: {
          p_app_id: string
          p_excerpt: string
          p_key: string
          p_reason: string
          p_source_title: string
          p_source_url: string
          p_state: string
          p_value: string
        }
        Returns: string
      }
      app_is_public: { Args: { p_app_id: string }; Returns: boolean }
      app_profile_report: { Args: { p_app_id: string }; Returns: Json }
      begin_app_claim: { Args: { p_app_id: string }; Returns: string }
      canonical_app_url: { Args: { value: string }; Returns: string }
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      claim_app_ownership: {
        Args: {
          p_app_id: string
          p_claim_id: string
          p_token: string
          p_url: string
          p_user_id: string
        }
        Returns: boolean
      }
      company_is_public: { Args: { p_company_id: string }; Returns: boolean }
      compute_evidence_score: { Args: { p_app_id: string }; Returns: number }
      compute_profile_completeness: {
        Args: { p_app_id: string }
        Returns: number
      }
      decide_launch: {
        Args: { p_decision: string; p_launch_id: string; p_note?: string }
        Returns: undefined
      }
      developer_dashboard: { Args: { p_days?: number }; Returns: Json }
      duplicate_target: { Args: { p_slug: string }; Returns: string }
      feature_enabled: {
        Args: { p_app_id?: string; p_key: string }
        Returns: boolean
      }
      grant_entitlement: {
        Args: {
          p_app_id: string
          p_ends_at: string
          p_note: string
          p_plan: string
          p_username: string
        }
        Returns: string
      }
      has_entitlement: {
        Args: { p_app_id?: string; p_key: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_eea_country: { Args: { code: string }; Returns: boolean }
      is_eu_country: { Args: { code: string }; Returns: boolean }
      is_moderator: { Args: never; Returns: boolean }
      is_service_role: { Args: never; Returns: boolean }
      manages_app: { Args: { p_app_id: string }; Returns: boolean }
      manages_company: { Args: { p_company_id: string }; Returns: boolean }
      merge_duplicate_app: {
        Args: { p_duplicate_id: string; p_reason: string; p_target_id: string }
        Returns: Json
      }
      moderate: {
        Args: { p_id: string; p_kind: string; p_reason?: string }
        Returns: undefined
      }
      moderate_request: {
        Args: { p_decision: string; p_note: string; p_request_id: string }
        Returns: undefined
      }
      my_app_profile_report: { Args: { p_app_id: string }; Returns: Json }
      observe_fact: {
        Args: {
          p_app_id: string
          p_confidence?: number
          p_detail?: Json
          p_excerpt?: string
          p_key: string
          p_run_id?: string
          p_source_title: string
          p_source_url: string
          p_state: string
          p_value: string
        }
        Returns: string
      }
      owns_app: { Args: { p_app_id: string }; Returns: boolean }
      owns_comparison: { Args: { p_comparison_id: string }; Returns: boolean }
      owns_request: { Args: { p_request_id: string }; Returns: boolean }
      partner_metrics: {
        Args: { p_days?: number }
        Returns: {
          guidance_views: number
          outbound_opens: number
          page_views: number
          partner: string
          referral_code: string
        }[]
      }
      popular_apps: {
        Args: { p_days?: number; p_limit?: number; p_locale: string }
        Returns: {
          app_id: string
          score: number
        }[]
      }
      purge_old_events: { Args: { p_days?: number }; Returns: number }
      ranking_score: {
        Args: {
          avg_rating: number
          favorites_count: number
          opens_30d: number
          opens_7d: number
          quality_passed: number
          ratings_count: number
          reviews_count: number
        }
        Returns: number
      }
      rating_breakdown: {
        Args: { p_app_id: string }
        Returns: {
          stars: number
          total: number
        }[]
      }
      reassign_app_owner: {
        Args: { p_app_id: string; p_reason: string; p_username: string }
        Returns: undefined
      }
      record_app_checks: {
        Args: {
          p_app_id: string
          p_checks: Json
          p_details: Json
          p_url: string
        }
        Returns: boolean
      }
      record_verification_run: {
        Args: {
          p_app_id: string
          p_error?: string
          p_initiated_by: string
          p_results: Json
          p_run_type: string
          p_url: string
        }
        Returns: string
      }
      refresh_app_facts: {
        Args: { p_app_id: string; p_attribute_key?: string }
        Returns: undefined
      }
      refresh_app_search: { Args: { p_app_id: string }; Returns: undefined }
      refresh_app_trust: { Args: { p_app_id: string }; Returns: undefined }
      request_is_public: { Args: { p_request_id: string }; Returns: boolean }
      request_recheck: { Args: { p_app_id: string }; Returns: undefined }
      require_admin: { Args: never; Returns: undefined }
      require_moderator: { Args: never; Returns: undefined }
      require_reason: { Args: { p_reason: string }; Returns: undefined }
      review_evidence: {
        Args: { p_decision: string; p_evidence_id: string; p_note: string }
        Returns: string
      }
      revoke_contact: { Args: { p_response_id: string }; Returns: undefined }
      revoke_entitlement: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      revoke_ownership: {
        Args: { p_app_id: string; p_reason: string }
        Returns: undefined
      }
      search_catalog: {
        Args: {
          p_filters?: Json
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_sort?: string
        }
        Returns: {
          app_id: string
          score: number
          total: number
        }[]
      }
      share_contact: {
        Args: {
          p_consent_text: string
          p_fields: string[]
          p_response_id: string
        }
        Returns: string
      }
      shared_contact: { Args: { p_response_id: string }; Returns: Json }
      trending_score: {
        Args: {
          favorites_7d: number
          opens_7d: number
          ratings_7d: number
          reviews_7d: number
        }
        Returns: number
      }
      vendor_can_see_request: {
        Args: { p_request_id: string }
        Returns: boolean
      }
      write_audit: {
        Args: {
          p_action: string
          p_app_id: string
          p_next: Json
          p_previous: Json
          p_reason: string
          p_target_id: string
          p_target_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

