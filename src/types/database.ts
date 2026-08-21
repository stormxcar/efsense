export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ---- Raw Row types ----
export interface UserRow {
  id: string
  email: string
  username: string
  avatar: string | null
  role: 'admin' | 'editor' | 'moderator' | 'contributor' | 'user'
  status: 'active' | 'suspended' | 'banned'
  bio: string | null
  created_at: string
  last_login: string | null
}

export interface SeriesRow {
  id: string
  name: string
  slug: string
  description: string | null
  thumbnail: string | null
  status: 'published' | 'draft'
  created_at: string
  updated_at: string
}

export interface PostRow {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string | null
  cover_image: string | null
  author_id: string | null
  series_id: string | null
  status: 'draft' | 'published' | 'scheduled'
  view_count: number
  reading_time_minutes: number
  featured: boolean
  meta_title: string | null
  meta_desc: string | null
  og_image: string | null
  image_alt: string | null
  image_credit: string | null
  image_source_url: string | null
  scheduled_at: string | null
  league_id: string | null
  club_id: string | null
  player_id: string | null
  season_id: string | null
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface TaxonomyRow {
  id: string
  name: string
  slug: string
}

export interface GalleryImageRow {
  id: string
  post_id: string
  image_url: string
  image_alt: string
  caption: string | null
  image_credit: string | null
  image_source_url: string | null
  sort_order: number
  created_at: string
}

export interface TagRow {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface CommentRow {
  id: string
  post_id: string
  user_id: string
  parent_comment_id: string | null
  reply_to_comment_id: string | null
  reply_to_user_id: string | null
  reply_to_name: string | null
  content: string
  image_url: string | null
  image_status: 'visible' | 'hidden'
  image_hidden_at: string | null
  image_hidden_by: string | null
  status: 'visible' | 'hidden' | 'deleted'
  created_at: string
  updated_at: string
}

export interface NotificationRow {
  id: string
  user_id: string
  actor_id: string | null
  type: string
  title: string
  body: string | null
  link: string | null
  metadata: Json
  is_read: boolean
  created_at: string
}

export interface GroupedNotificationRow {
  id: string
  notification_ids: string[]
  group_count: number
  type: string
  title: string
  body: string | null
  link: string | null
  metadata: Json
  is_read: boolean
  created_at: string
  total_groups: number
}

export interface UserActivityEventRow {
  id: string
  user_id: string
  event_type: string
  target_type: string | null
  target_id: string | null
  metadata: Json
  created_at: string
}

export interface ProfilePreferenceRow {
  user_id: string
  profile_visibility: 'public' | 'members' | 'private'
  show_activity: boolean
  show_reading_stats: boolean
  email_notifications: boolean
  push_notifications: boolean
  notify_mentions: boolean
  notify_replies: boolean
  notify_follows: boolean
  notify_new_content: boolean
  updated_at: string
}

export interface ReadingCollectionRow {
  id: string
  user_id: string
  name: string
  description: string | null
  color: 'lime' | 'blue' | 'orange' | 'violet'
  created_at: string
  updated_at: string
}

export interface MemberBadgeRow {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  created_at: string
}

export interface RecommendedPostRow {
  post_id: string
  title: string
  slug: string
  excerpt: string | null
  cover_image: string | null
  series_id: string | null
  series_name: string | null
  series_slug: string | null
  published_at: string
  score: number
  is_liked?: boolean
}

export interface PostShareRow {
  id: string
  post_id: string
  user_id: string
  platform: string
  created_at: string
}

export interface ReportRow {
  id: string
  reporter_id: string
  reported_user_id: string
  reason: string
  description: string | null
  status: 'pending' | 'ignored' | 'warned' | 'locked'
  created_at: string
}

export interface CommunityPostRow {
  id: string
  author_id: string
  post_type: 'discussion' | 'reel' | 'showcase'
  title: string | null
  content: string
  media_url: string | null
  media_public_id: string | null
  media_type: 'image' | 'video' | null
  thumbnail_url: string | null
  game_version: string | null
  tactic: string | null
  status: 'published' | 'pending' | 'hidden'
  created_at: string
  updated_at: string
}

export interface CommunityGameVersionRow {
  version: string
  post_count: number
}

export interface WeeklyCommunityCreatorRow {
  rank_position: number
  creator_id: string
  username: string
  avatar: string | null
  post_count: number
  reaction_count: number
  comment_count: number
  share_count: number
  view_count: number
  creator_score: number
}

export interface CommunityPopularRankRow {
  post_id: string
  reaction_count: number
  comment_count: number
  share_count: number
  view_count: number
  quality_score: number
  freshness_score: number
  popular_score: number
  total_count: number
}

export interface CommunityPollOption {
  id: string
  label: string
  sort_order: number
  votes?: { count: number }[]
}

export interface CommunityPoll {
  id: string
  post_id: string
  question: string
  closes_at: string | null
  options: CommunityPollOption[]
}

export interface CommunityPostMedia {
  id: string
  post_id: string
  media_type: 'image' | 'video'
  media_url: string
  media_public_id: string | null
  thumbnail_url: string | null
  alt: string | null
  sort_order: number
  created_at?: string
}

export type CommunityReactionType = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry'

export interface CommunityReactionSummary {
  reaction: CommunityReactionType
  count: number
}

export interface CommunityCommentReactionSummary extends CommunityReactionSummary {
  comment_id: string
}

export interface CommunityTag {
  id: string
  name: string
  slug: string
}

export interface CommunityCommentRow {
  id: string
  post_id: string
  user_id: string
  parent_comment_id: string | null
  reply_to_comment_id: string | null
  reply_to_user_id: string | null
  reply_to_name: string | null
  content: string
  image_url: string | null
  image_status: 'visible' | 'hidden'
  image_hidden_at: string | null
  image_hidden_by: string | null
  display_name_mode: 'account' | 'anonymous' | 'alias'
  display_name: string | null
  status: 'visible' | 'hidden' | 'deleted'
  created_at: string
  updated_at: string
}

export interface CommentRevisionRow {
  id: string
  comment_type: 'post' | 'community'
  comment_id: string
  editor_id: string | null
  old_content: string | null
  new_content: string | null
  old_image_url: string | null
  new_image_url: string | null
  metadata: Json
  created_at: string
}

export interface AdminModerationCommentRow {
  comment_type: 'post' | 'community'
  id: string
  content: string
  image_url: string | null
  image_status: 'visible' | 'hidden'
  status: 'visible' | 'hidden' | 'deleted'
  created_at: string
  updated_at: string
  parent_comment_id: string | null
  user_id: string
  user_username: string
  user_email: string
  user_avatar: string | null
  display_name_mode: 'account' | 'anonymous' | 'alias'
  display_name: string | null
  target_id: string
  target_title: string
  target_slug: string | null
  media_public_id: string | null
  media_folder: string | null
  revision_count: number
  total_count: number
}

export interface AuditLogRow {
  id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Json
  created_at: string
  actor?: Pick<UserRow, 'username' | 'avatar'> | null
}

export interface HistoryTimelineEventRow {
  id: string
  year: number
  era: string
  title: string
  description: string
  accent_color: string
  post_id: string | null
  media_url: string | null
  media_type: 'image' | 'video' | null
  sort_order: number
  status: 'draft' | 'published'
  created_at: string
  updated_at: string
}

export interface MediaAssetRow {
  id: string
  public_id: string
  secure_url: string
  resource_type: 'image' | 'video' | 'raw'
  folder: string | null
  owner_id: string | null
  metadata: Json
  status: 'pending' | 'referenced' | 'orphaned'
  pending_expires_at: string | null
  referenced_at: string | null
  last_seen_at: string
  created_at: string
}

// ---- Database type for Supabase client ----
export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserRow
        Insert: Partial<UserRow>
        Update: Partial<UserRow>
      }
      series: {
        Row: SeriesRow
        Insert: Partial<SeriesRow>
        Update: Partial<SeriesRow>
      }
      posts: {
        Row: PostRow
        Insert: Partial<PostRow>
        Update: Partial<PostRow>
      }
      leagues: {
        Row: TaxonomyRow & { country: string | null; logo_url: string | null; created_at: string }
        Insert: Partial<TaxonomyRow & { country: string | null; logo_url: string | null }>
        Update: Partial<TaxonomyRow & { country: string | null; logo_url: string | null }>
      }
      clubs: {
        Row: TaxonomyRow & { league_id: string | null; logo_url: string | null; created_at: string }
        Insert: Partial<TaxonomyRow & { league_id: string | null; logo_url: string | null }>
        Update: Partial<TaxonomyRow & { league_id: string | null; logo_url: string | null }>
      }
      players: {
        Row: TaxonomyRow & { club_id: string | null; photo_url: string | null; created_at: string }
        Insert: Partial<TaxonomyRow & { club_id: string | null; photo_url: string | null }>
        Update: Partial<TaxonomyRow & { club_id: string | null; photo_url: string | null }>
      }
      seasons: {
        Row: TaxonomyRow & { starts_on: string | null; ends_on: string | null; created_at: string }
        Insert: Partial<TaxonomyRow & { starts_on: string | null; ends_on: string | null }>
        Update: Partial<TaxonomyRow & { starts_on: string | null; ends_on: string | null }>
      }
      post_gallery_images: {
        Row: GalleryImageRow
        Insert: Partial<GalleryImageRow>
        Update: Partial<GalleryImageRow>
      }
      tags: {
        Row: TagRow
        Insert: Partial<TagRow>
        Update: Partial<TagRow>
      }
      post_tags: {
        Row: { post_id: string; tag_id: string }
        Insert: { post_id: string; tag_id: string }
        Update: { post_id?: string; tag_id?: string }
      }
      comments: {
        Row: CommentRow
        Insert: Partial<CommentRow>
        Update: Partial<CommentRow>
      }
      likes: {
        Row: { user_id: string; post_id: string; created_at: string }
        Insert: { user_id: string; post_id: string }
        Update: { user_id?: string; post_id?: string }
      }
      bookmarks: {
        Row: { user_id: string; post_id: string; created_at: string }
        Insert: { user_id: string; post_id: string }
        Update: { user_id?: string; post_id?: string }
      }
      follows: {
        Row: { user_id: string; series_id: string; created_at: string }
        Insert: { user_id: string; series_id: string }
        Update: { user_id?: string; series_id?: string }
      }
      post_shares: {
        Row: PostShareRow
        Insert: { post_id: string; user_id: string; platform: string }
        Update: Record<string, never>
      }
      notifications: {
        Row: NotificationRow
        Insert: Partial<NotificationRow>
        Update: Partial<NotificationRow>
      }
      user_activity_events: {
        Row: UserActivityEventRow
        Insert: Partial<UserActivityEventRow>
        Update: Partial<UserActivityEventRow>
      }
      profile_preferences: {
        Row: ProfilePreferenceRow
        Insert: Partial<ProfilePreferenceRow> & { user_id: string }
        Update: Partial<ProfilePreferenceRow>
      }
      reading_collections: {
        Row: ReadingCollectionRow
        Insert: Partial<ReadingCollectionRow> & { user_id: string; name: string }
        Update: Partial<ReadingCollectionRow>
      }
      reading_collection_items: {
        Row: { collection_id: string; post_id: string; added_at: string }
        Insert: { collection_id: string; post_id: string }
        Update: never
      }
      member_badges: {
        Row: MemberBadgeRow
        Insert: Partial<MemberBadgeRow> & { slug: string; name: string; description: string; icon: string }
        Update: Partial<MemberBadgeRow>
      }
      user_badges: {
        Row: { user_id: string; badge_id: string; awarded_at: string; metadata: Json }
        Insert: { user_id: string; badge_id: string; metadata?: Json }
        Update: never
      }
      reports: {
        Row: ReportRow
        Insert: Partial<ReportRow>
        Update: Partial<ReportRow>
      }
      login_attempts: {
        Row: { id: string; email: string; ip_address: string; success: boolean; attempted_at: string }
        Insert: { email: string; ip_address: string; success: boolean }
        Update: Record<string, never>
      }
      ip_blocks: {
        Row: { id: string; ip_address: string; attempt_count: number; blocked_until: string | null; created_at: string; updated_at: string }
        Insert: { ip_address: string; attempt_count?: number; blocked_until?: string | null }
        Update: { attempt_count?: number; blocked_until?: string | null }
      }
      community_posts: {
        Row: CommunityPostRow
        Insert: Partial<CommunityPostRow>
        Update: Partial<CommunityPostRow>
      }
      community_tags: {
        Row: CommunityTag & { created_by: string | null; created_at: string }
        Insert: Partial<CommunityTag & { created_by: string | null; created_at: string }>
        Update: Partial<CommunityTag & { created_by: string | null; created_at: string }>
      }
      community_post_tags: {
        Row: { post_id: string; tag_id: string; created_at: string }
        Insert: { post_id: string; tag_id: string }
        Update: Partial<{ post_id: string; tag_id: string }>
      }
      community_tag_follows: {
        Row: { user_id: string; tag_id: string; created_at: string }
        Insert: { user_id: string; tag_id: string }
        Update: never
      }
      community_post_media: {
        Row: CommunityPostMedia
        Insert: Partial<CommunityPostMedia>
        Update: Partial<CommunityPostMedia>
      }
      community_post_polls: {
        Row: CommunityPoll
        Insert: Partial<CommunityPoll>
        Update: Partial<CommunityPoll>
      }
      community_post_poll_options: {
        Row: CommunityPollOption & { poll_id: string }
        Insert: Partial<CommunityPollOption & { poll_id: string }>
        Update: Partial<CommunityPollOption & { poll_id: string }>
      }
      community_post_poll_votes: {
        Row: { poll_id: string; option_id: string; user_id: string; created_at: string }
        Insert: { poll_id: string; option_id: string; user_id: string }
        Update: Partial<{ poll_id: string; option_id: string; user_id: string }>
      }
      community_post_likes: {
        Row: { post_id: string; user_id: string; reaction: CommunityReactionType; created_at: string }
        Insert: { post_id: string; user_id: string; reaction?: CommunityReactionType }
        Update: Partial<{ post_id: string; user_id: string; reaction: CommunityReactionType }>
      }
      community_comment_reactions: {
        Row: { comment_id: string; user_id: string; reaction: CommunityReactionType; created_at: string }
        Insert: { comment_id: string; user_id: string; reaction?: CommunityReactionType }
        Update: Partial<{ comment_id: string; user_id: string; reaction: CommunityReactionType }>
      }
      community_post_bookmarks: {
        Row: { post_id: string; user_id: string; created_at: string }
        Insert: { post_id: string; user_id: string }
        Update: Partial<{ post_id: string; user_id: string }>
      }
      community_user_relations: {
        Row: { follower_id: string; target_user_id: string; relation_type: 'follow' | 'mute' | 'block'; created_at: string }
        Insert: { follower_id: string; target_user_id: string; relation_type: 'follow' | 'mute' | 'block' }
        Update: Partial<{ follower_id: string; target_user_id: string; relation_type: 'follow' | 'mute' | 'block' }>
      }
      community_post_comments: {
        Row: CommunityCommentRow
        Insert: Partial<CommunityCommentRow>
        Update: Partial<CommunityCommentRow>
      }
      community_post_views: {
        Row: { id: string; post_id: string; viewer_id: string | null; visitor_key: string; created_at: string }
        Insert: Partial<{ id: string; post_id: string; viewer_id: string | null; visitor_key: string; created_at: string }>
        Update: never
      }
      community_post_shares: {
        Row: { id: string; post_id: string; user_id: string | null; visitor_key: string; platform: string; created_at: string }
        Insert: Partial<{ id: string; post_id: string; user_id: string | null; visitor_key: string; platform: string; created_at: string }>
        Update: never
      }
      comment_revisions: {
        Row: CommentRevisionRow
        Insert: Partial<CommentRevisionRow>
        Update: never
      }
      history_timeline_events: {
        Row: HistoryTimelineEventRow
        Insert: Partial<HistoryTimelineEventRow>
        Update: Partial<HistoryTimelineEventRow>
      }
      media_assets: {
        Row: MediaAssetRow
        Insert: Partial<MediaAssetRow>
        Update: Partial<MediaAssetRow>
      }
      community_abuse_events: {
        Row: { id: string; actor_user_id: string | null; action: 'comment' | 'report' | 'post'; ip_hash: string; fingerprint_hash: string | null; passed: boolean; metadata: Json; created_at: string }
        Insert: Partial<{ id: string; actor_user_id: string | null; action: 'comment' | 'report' | 'post'; ip_hash: string; fingerprint_hash: string | null; passed: boolean; metadata: Json; created_at: string }>
        Update: never
      }
    }
    Views: {
      community_post_reaction_counts: {
        Row: { post_id: string; reaction: CommunityReactionType; count: number }
        Insert: never
        Update: never
      }
      community_comment_reaction_counts: {
        Row: { comment_id: string; reaction: CommunityReactionType; count: number }
        Insert: never
        Update: never
      }
    }
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      record_post_view: { Args: { p_post_id: string; p_visitor_key: string }; Returns: number }
      weekly_popular_posts: { Args: { p_limit?: number }; Returns: { post_id: string; weekly_views: number }[] }
      subscribe_newsletter: { Args: { p_email: string }; Returns: string }
      record_user_activity: { Args: { p_user_id: string; p_event_type: string; p_target_type?: string | null; p_target_id?: string | null; p_metadata?: Json }; Returns: string }
      recommended_posts: { Args: { p_user_id?: string | null; p_limit?: number }; Returns: RecommendedPostRow[] }
      admin_dashboard_summary: { Args: { p_days?: number }; Returns: Json }
      admin_dashboard_timeseries: { Args: { p_days?: number }; Returns: { day: string; dau: number; reads: number; reels: number; approved: number }[] }
      find_orphan_media_assets: { Args: { p_limit?: number }; Returns: { id: string; public_id: string; secure_url: string; resource_type: string; folder: string | null; owner_id: string | null; created_at: string; last_seen_at: string }[] }
      cleanup_orphan_media_assets: { Args: { p_ids: string[] }; Returns: number }
      mark_media_assets_referenced: { Args: { p_public_ids: string[]; p_reference_type?: string | null; p_reference_id?: string | null }; Returns: number }
      sync_pending_media_references: { Args: Record<string, never>; Returns: number }
      cleanup_expired_pending_media_assets: { Args: { p_limit?: number }; Returns: number }
      record_community_post_view: { Args: { p_post_id: string; p_visitor_key: string }; Returns: boolean }
      record_community_post_share: { Args: { p_post_id: string; p_platform: string; p_visitor_key: string }; Returns: boolean }
      popular_community_posts: { Args: { p_type?: string; p_viewer_id?: string | null; p_author_id?: string | null; p_collection?: string | null; p_search?: string | null; p_tag_slug?: string | null; p_game_version?: string | null; p_limit?: number; p_offset?: number }; Returns: CommunityPopularRankRow[] }
      comment_reply_counts: { Args: { p_comment_type: 'post' | 'community'; p_parent_ids: string[] }; Returns: Array<{ parent_id: string; reply_count: number }> }
      community_game_versions: { Args: { p_limit?: number }; Returns: CommunityGameVersionRow[] }
      weekly_community_creator_ranking: { Args: { p_limit?: number }; Returns: WeeklyCommunityCreatorRow[] }
      grouped_notifications: { Args: { p_limit?: number; p_filter?: string }; Returns: GroupedNotificationRow[] }
      mark_notification_group_read: { Args: { p_notification_ids: string[] }; Returns: number }
      moderate_comment_image: { Args: { p_comment_type: string; p_comment_id: string; p_hidden: boolean }; Returns: boolean }
      moderate_comment_record: { Args: { p_comment_type: string; p_comment_id: string; p_action: string }; Returns: boolean }
      admin_comment_feed: { Args: { p_limit?: number; p_offset?: number; p_status?: string | null; p_comment_type?: string | null; p_search?: string | null; p_sort?: string }; Returns: AdminModerationCommentRow[] }
      admin_audit_summary: { Args: { p_days?: number }; Returns: Json }
      profile_overview: { Args: Record<string, never>; Returns: Json }
      profile_activity_feed: { Args: { p_limit?: number; p_offset?: number }; Returns: Array<{ id: string; event_type: string; target_type: string | null; target_id: string | null; target_title: string; target_slug: string | null; context_text: string | null; reply_to_name: string | null; reaction: string | null; comment_id: string | null; metadata: Json; created_at: string; total_count: number }> }
      refresh_my_profile_badges: { Args: Record<string, never>; Returns: number }
    }
    Enums: Record<string, never>
  }
}

// Extended types with joins
export interface PostWithDetails extends PostRow {
  author?: UserRow | null
  series?: SeriesRow | null
  tags?: TagRow[]
  likes_count?: number
  comments_count?: number
  is_liked?: boolean
  is_bookmarked?: boolean
  weekly_views?: number
  post_gallery_images?: GalleryImageRow[]
  likes?: { count: number }[]
  comments?: { count: number }[]
}

export interface CommentWithUser extends CommentRow {
  user?: UserRow | null
  replies?: CommentWithUser[]
  reply_count?: number
}

export interface CommunityPostWithDetails extends CommunityPostRow {
  author?: Pick<UserRow, 'id' | 'username' | 'avatar'> | null
  likes?: { count: number }[]
  comments?: { count: number }[]
  community_post_likes?: { user_id: string }[]
  reactions?: CommunityReactionSummary[]
  community_post_comments?: { count: number }[]
  likes_count?: number
  comments_count?: number
  is_liked?: boolean
  poll?: CommunityPoll | null
  tags?: { tag: CommunityTag | null }[]
  media?: CommunityPostMedia[]
  popular_score?: number
  quality_score?: number
  share_count?: number
  community_view_count?: number
}

export interface CommunityCommentWithUser extends CommunityCommentRow {
  user?: Pick<UserRow, 'id' | 'username' | 'avatar'> | null
  replies?: CommunityCommentWithUser[]
  reply_count?: number
}

export interface HistoryTimelineEventWithPost extends HistoryTimelineEventRow {
  post?: Pick<PostRow, 'id' | 'title' | 'slug'> | null
}
