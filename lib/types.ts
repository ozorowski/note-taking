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
