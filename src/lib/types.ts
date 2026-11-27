export type AppUser = { id: string; email?: string | null }

export type Profile = {
  id: string
  username: string
  display_name: string
  bio: string | null
  avatar_url: string | null
  is_private: boolean
  is_suspended?: boolean
  created_at?: string
}

export type Post = {
  id: string
  user_id: string
  caption: string
  hashtags?: string[] | null
  video_path?: string | null
  video_url: string
  duration_seconds: number
  created_at: string
  visibility: 'public' | 'followers' | 'private'
  moderation_status?: 'approved' | 'review' | 'removed'
  profile: Profile
  likes_count: number
  comments_count: number
  liked_by_me: boolean
  saved_by_me: boolean
}

export type Comment = {
  id: string
  post_id: string
  user_id: string
  body: string
  created_at: string
  profile: Profile
}

export type NotificationItem = {
  id: string
  type: 'follow' | 'like' | 'comment' | 'follow_request'
  created_at: string
  actor: Profile
  post_id?: string | null
  read_at?: string | null
}
