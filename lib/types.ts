export interface User {
  id: string
  email: string
  name: string
  password_hash: string
  created_at: Date
}

export interface Board {
  id: string
  title: string
  description: string | null
  owner_id: string
  created_at: Date
  updated_at: Date
}

export interface BoardMembership {
  id: string
  board_id: string
  user_id: string
  role: 'owner' | 'editor' | 'viewer'
  created_at: Date
}

export interface List {
  id: string
  board_id: string
  title: string
  position: number
  created_at: Date
  updated_at: Date
}

export interface Card {
  id: string
  list_id: string
  title: string
  description: string | null
  position: number
  ai_summary: string | null
  created_at: Date
  updated_at: Date
}

export interface CardTag {
  id: string
  card_id: string
  tag: string
  created_at: Date
}

export interface Comment {
  id: string
  card_id: string
  user_id: string
  content: string
  created_at: Date
}

export interface AuthToken {
  user_id: string
  email: string
  iat: number
  exp: number
}

// ── Trace types ───────────────────────────────────────────────────────────────

export type Phase = 'interviews' | 'capture' | 'notes' | 'themes' | 'insights' | 'recommendations' | 'complete'
export type PhaseStatus = 'locked' | 'in_progress' | 'complete'
export type Role = 'owner' | 'editor' | 'viewer'

// ── Archetypes & Emerging Needs ───────────────────────────────────────────────

export interface EmergingNeed {
  need_statement: string        // "Users need a way to…"
  context: string               // When/where it surfaces
  linked_insight_ids: string[]  // ≥1 insight
  evidence_summary: string      // note count, participant spread
  confidence: 'High' | 'Medium' | 'Low'
  rationale: string
}

export interface UserArchetype {
  name: string                  // Behavioural, e.g. "Time-pressured repeat user"
  core_goal: string
  typical_context: string
  key_behaviours: string[]
  attached_need_indices: number[] // indices into the sibling needs array
  evidence_summary: string
  confidence: 'High' | 'Medium' | 'Low'
  unknowns: string              // "What we don't know yet"
}

export interface ArchetypesData {
  needs: EmergingNeed[]
  archetypes: UserArchetype[]
}

export interface Project {
  id: string
  title: string
  description: string | null
  current_phase: Phase
  owner_id: string
  demo: boolean
  has_guide?: boolean
  executive_summary?: string | null
  executive_summary_generated_at?: string | null
  archetypes_data?: ArchetypesData | null
  archetypes_generated_at?: string | null
  created_at: Date
  updated_at: Date
}

export interface ProjectMembership {
  id: string
  project_id: string
  user_id: string
  role: Role
  created_at: Date
}

export interface Interview {
  id: string
  project_id: string
  participant_name: string
  raw_notes: string | null
  created_by: string | null
  created_at: Date
  updated_at: Date
  display_number?: number
  creator_name?: string
  consent_confirmed?: boolean
  consent_confirmed_at?: Date | null
  consent_confirmed_by?: string | null
}

export interface GuideQuestion {
  id: string
  project_id: string
  text: string
  stage_label: string | null
  order_index: number
  is_catch_all: boolean
  created_at: Date
}

export interface Note {
  id: string
  project_id: string
  interview_id: string | null
  content: string
  evidence_type?: 'quote' | 'observation' | 'pain_point' | 'need' | null
  visibility?: 'private' | 'shared'
  source_type?: 'interview' | 'url_import'
  source_url?: string | null
  source_author?: string | null
  created_by: string | null
  created_at: Date
  updated_at: Date
  display_number?: number
  // joined fields
  tags?: string[]
  interview_name?: string
  creator_name?: string
  theme_ids?: string[]
  guide_question_id?: string | null
  guide_question_text?: string
  capture_group_id?: string | null
}

export interface CaptureGroup {
  id: string
  project_id: string
  interview_id: string
  created_by: string | null
  created_at: Date
}

export interface Theme {
  id: string
  project_id: string
  title: string
  description: string | null
  ai_suggested_name: string | null
  created_by: string | null
  created_at: Date
  updated_at: Date
  display_number?: number
  sort_order?: number
  // joined fields
  note_count?: number
  notes?: Note[]
  creator_name?: string
}

export interface Insight {
  id: string
  project_id: string
  content: string
  evidence_summary: string | null
  ai_draft: string | null
  root_cause?: string | null
  iqs_score?: number | null
  supporting_note_ids?: string[] | null
  created_by: string | null
  created_at: Date
  updated_at: Date
  display_number?: number
  // joined fields
  themes?: Theme[]
  theme_ids?: string[]
  creator_name?: string
}

export interface Recommendation {
  id: string
  project_id: string
  content: string
  rationale: string | null
  ai_draft: string | null
  created_by: string | null
  created_at: Date
  updated_at: Date
  display_number?: number
  // joined fields
  insights?: Insight[]
  insight_ids?: string[]
  creator_name?: string
}

export interface ProjectActivity {
  id: string
  project_id: string
  user_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  created_at: Date
  user_name?: string
}

export interface ProjectCounts {
  interview_count: number
  note_count: number
  private_note_count: number
  clustered_note_count: number
  theme_count: number
  insight_count: number
  insights_with_themes: number
  recommendation_count: number
  recommendations_with_insights: number
  notes_linked_to_interview: number
}

export interface FullProject extends Project {
  role: Role
  members: Array<{ id: string; name: string; role: Role }>
  interviews: Interview[]
  notes: Note[]
  themes: Theme[]
  insights: Insight[]
  recommendations: Recommendation[]
  counts: ProjectCounts
  guide_questions: GuideQuestion[]
}
