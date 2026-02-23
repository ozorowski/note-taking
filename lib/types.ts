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

export type Phase = 'interviews' | 'notes' | 'themes' | 'insights' | 'recommendations' | 'complete'
export type PhaseStatus = 'locked' | 'in_progress' | 'complete'
export type Role = 'owner' | 'editor' | 'viewer'

export interface Project {
  id: string
  title: string
  description: string | null
  current_phase: Phase
  owner_id: string
  demo: boolean
  executive_summary?: string | null
  executive_summary_generated_at?: string | null
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
}

export interface Note {
  id: string
  project_id: string
  interview_id: string | null
  content: string
  created_by: string | null
  created_at: Date
  updated_at: Date
  // joined fields
  tags?: string[]
  interview_name?: string
  creator_name?: string
  theme_ids?: string[]
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
  // joined fields
  note_count?: number
  notes?: Note[]
}

export interface Insight {
  id: string
  project_id: string
  content: string
  evidence_summary: string | null
  ai_draft: string | null
  created_by: string | null
  created_at: Date
  updated_at: Date
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
}
