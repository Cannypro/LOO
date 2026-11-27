import { supabase } from './supabase'
import { demoPosts, demoProfile } from './demo'
import type { Comment, NotificationItem, Post, Profile } from './types'

const PROFILE_SELECT = 'id,username,display_name,bio,avatar_url,is_private,is_suspended,created_at'

function readCount(value: unknown): number {
  if (!Array.isArray(value) || !value.length) return 0
  const first = value[0] as { count?: number }
  return Number(first?.count ?? 0)
}

function extractHashtags(caption: string): string[] {
  return [...new Set((caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((tag) => tag.slice(1).toLowerCase()))].slice(0, 8)
}

export async function getFeed(userId: string, tab: 'for-you' | 'following' = 'for-you'): Promise<Post[]> {
  if (!supabase || userId === 'demo-user') return demoPosts

  let followedIds: string[] = []
  if (tab === 'following') {
    const { data: follows, error: followError } = await supabase.from('follows').select('following_id').eq('follower_id', userId).eq('status', 'accepted')
    if (followError) throw followError
    followedIds = (follows ?? []).map((row) => row.following_id as string)
    if (!followedIds.length) return []
  }

  let query = supabase
    .from('posts')
    .select(`id,user_id,caption,hashtags,video_path,duration_seconds,created_at,visibility,moderation_status,profiles!posts_user_id_fkey(${PROFILE_SELECT}),likes(count),comments(count)`)
    .eq('moderation_status', 'approved')

  if (tab === 'following') query = query.in('user_id', followedIds)

  const { data, error } = await query.order('created_at', { ascending: false }).limit(40)
  if (error) throw error

  const postRows = (data ?? []) as unknown as Array<Record<string, unknown>>
  const postIds = postRows.map((row) => row.id as string)
  const [likedResult, savedResult] = await Promise.all([
    postIds.length ? supabase.from('likes').select('post_id').eq('user_id', userId).in('post_id', postIds) : Promise.resolve({ data: [], error: null }),
    postIds.length ? supabase.from('saved_posts').select('post_id').eq('user_id', userId).in('post_id', postIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (likedResult.error) throw likedResult.error
  if (savedResult.error) throw savedResult.error
  const liked = new Set((likedResult.data ?? []).map((row) => row.post_id as string))
  const saved = new Set((savedResult.data ?? []).map((row) => row.post_id as string))

  return Promise.all(postRows.map(async (row) => {
    const profile = row.profiles as Profile
    let videoUrl = ''
    if (row.video_path) {
      const { data: signed, error: signedError } = await supabase!.storage.from('loop-videos').createSignedUrl(row.video_path as string, 60 * 45)
      if (!signedError) videoUrl = signed.signedUrl
    }
    return {
      id: row.id as string,
      user_id: row.user_id as string,
      caption: row.caption as string,
      hashtags: (row.hashtags as string[]) ?? [],
      video_path: row.video_path as string,
      video_url: videoUrl,
      duration_seconds: Number(row.duration_seconds),
      created_at: row.created_at as string,
      visibility: row.visibility as Post['visibility'],
      moderation_status: row.moderation_status as Post['moderation_status'],
      profile,
      likes_count: readCount(row.likes),
      comments_count: readCount(row.comments),
      liked_by_me: liked.has(row.id as string),
      saved_by_me: saved.has(row.id as string),
    }
  }))
}

export async function toggleLike(post: Post, userId: string): Promise<boolean> {
  if (!supabase || userId === 'demo-user') return !post.liked_by_me
  if (post.liked_by_me) {
    const { error } = await supabase.from('likes').delete().eq('user_id', userId).eq('post_id', post.id)
    if (error) throw error
    return false
  }
  const { error } = await supabase.from('likes').insert({ user_id: userId, post_id: post.id })
  if (error) throw error
  return true
}

export async function toggleSave(post: Post, userId: string): Promise<boolean> {
  if (!supabase || userId === 'demo-user') return !post.saved_by_me
  if (post.saved_by_me) {
    const { error } = await supabase.from('saved_posts').delete().eq('user_id', userId).eq('post_id', post.id)
    if (error) throw error
    return false
  }
  const { error } = await supabase.from('saved_posts').insert({ user_id: userId, post_id: post.id })
  if (error) throw error
  return true
}

export async function getComments(postId: string): Promise<Comment[]> {
  if (!supabase || postId.startsWith('demo-')) return []
  const { data, error } = await supabase.from('comments').select(`id,post_id,user_id,body,created_at,profiles!comments_user_id_fkey(${PROFILE_SELECT})`).eq('post_id', postId).eq('moderation_status', 'approved').order('created_at', { ascending: true }).limit(100)
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, profile: row.profiles as unknown as Profile })) as Comment[]
}

export async function addComment(postId: string, userId: string, body: string): Promise<void> {
  if (!supabase || userId === 'demo-user') return
  const { error } = await supabase.from('comments').insert({ post_id: postId, user_id: userId, body: body.trim() })
  if (error) throw error
}

export async function followUser(targetId: string, userId: string): Promise<void> {
  if (!supabase || userId === 'demo-user') return
  const { error } = await supabase.from('follows').insert({ follower_id: userId, following_id: targetId })
  if (error) throw error
}

export async function unfollowUser(targetId: string, userId: string): Promise<void> {
  if (!supabase || userId === 'demo-user') return
  const { error } = await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', targetId)
  if (error) throw error
}


export async function getFollowingStates(userId: string): Promise<{ accepted: string[]; pending: string[] }> {
  if (!supabase || userId === 'demo-user') return { accepted: [], pending: [] }
  const { data, error } = await supabase.from('follows').select('following_id,status').eq('follower_id', userId).in('status', ['accepted', 'pending'])
  if (error) throw error
  return {
    accepted: (data ?? []).filter((row) => row.status === 'accepted').map((row) => row.following_id as string),
    pending: (data ?? []).filter((row) => row.status === 'pending').map((row) => row.following_id as string),
  }
}

export async function getProfile(username: string): Promise<Profile | null> {
  if (!supabase) return username.replace(/^@/, '') === demoProfile.username ? demoProfile : (demoPosts.find((post) => post.profile.username === username.replace(/^@/, ''))?.profile ?? null)
  const { data, error } = await supabase.from('profiles').select(PROFILE_SELECT).eq('username', username.replace(/^@/, '')).maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export async function getProfilePosts(profileId: string, viewerId: string): Promise<Post[]> {
  if (!supabase || profileId.startsWith('creator-') || profileId === 'demo-user') return demoPosts.filter((post) => post.user_id === profileId)
  const baseQuery = supabase.from('posts').select(`id,user_id,caption,hashtags,video_path,duration_seconds,created_at,visibility,moderation_status,profiles!posts_user_id_fkey(${PROFILE_SELECT}),likes(count),comments(count)`).eq('user_id', profileId)
  const { data, error } = profileId === viewerId
    ? await baseQuery.in('moderation_status', ['approved', 'review']).order('created_at', { ascending: false })
    : await baseQuery.eq('moderation_status', 'approved').order('created_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>
  return Promise.all(rows.map(async (row) => {
    const { data: signed } = await supabase!.storage.from('loop-videos').createSignedUrl(row.video_path as string, 60 * 45)
    const { data: liked } = await supabase!.from('likes').select('post_id').eq('post_id', row.id as string).eq('user_id', viewerId).maybeSingle()
    const { data: saved } = await supabase!.from('saved_posts').select('post_id').eq('post_id', row.id as string).eq('user_id', viewerId).maybeSingle()
    return {
      id: row.id as string, user_id: row.user_id as string, caption: row.caption as string, hashtags: row.hashtags as string[],
      video_path: row.video_path as string, video_url: signed?.signedUrl ?? '', duration_seconds: Number(row.duration_seconds),
      created_at: row.created_at as string, visibility: row.visibility as Post['visibility'], moderation_status: row.moderation_status as Post['moderation_status'],
      profile: row.profiles as Profile, likes_count: readCount(row.likes), comments_count: readCount(row.comments), liked_by_me: Boolean(liked), saved_by_me: Boolean(saved),
    }
  }))
}

export async function getSavedPosts(userId: string): Promise<Post[]> {
  if (!supabase || userId === 'demo-user') return demoPosts.filter((post) => post.saved_by_me)
  const { data: savedRows, error: savedError } = await supabase.from('saved_posts').select('post_id').eq('user_id', userId)
  if (savedError) throw savedError
  const ids = (savedRows ?? []).map((row) => row.post_id as string)
  if (!ids.length) return []
  const { data, error } = await supabase.from('posts').select(`id,user_id,caption,hashtags,video_path,duration_seconds,created_at,visibility,moderation_status,profiles!posts_user_id_fkey(${PROFILE_SELECT}),likes(count),comments(count)`).in('id', ids).eq('moderation_status', 'approved').order('created_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>
  const likedResult = await supabase.from('likes').select('post_id').eq('user_id', userId).in('post_id', ids)
  if (likedResult.error) throw likedResult.error
  const liked = new Set((likedResult.data ?? []).map((row) => row.post_id as string))
  return Promise.all(rows.map(async (row) => {
    const { data: signed } = await supabase!.storage.from('loop-videos').createSignedUrl(row.video_path as string, 60 * 45)
    return {
      id: row.id as string, user_id: row.user_id as string, caption: row.caption as string, hashtags: (row.hashtags as string[]) ?? [],
      video_path: row.video_path as string, video_url: signed?.signedUrl ?? '', duration_seconds: Number(row.duration_seconds),
      created_at: row.created_at as string, visibility: row.visibility as Post['visibility'], moderation_status: row.moderation_status as Post['moderation_status'],
      profile: row.profiles as Profile, likes_count: readCount(row.likes), comments_count: readCount(row.comments), liked_by_me: liked.has(row.id as string), saved_by_me: true,
    }
  }))
}

export async function searchPosts(term: string, userId: string): Promise<Post[]> {
  const safe = term.trim().replace(/^#/, '').replace(/[%,]/g, ' ').slice(0, 60)
  if (!safe) return []
  if (!supabase || userId === 'demo-user') {
    const needle = safe.toLowerCase()
    return demoPosts.filter((post) => post.caption.toLowerCase().includes(needle) || (post.hashtags ?? []).some((tag) => tag.toLowerCase().includes(needle)))
  }

  const select = `id,user_id,caption,hashtags,video_path,duration_seconds,created_at,visibility,moderation_status,profiles!posts_user_id_fkey(${PROFILE_SELECT}),likes(count),comments(count)`
  const [captionResult, hashtagResult] = await Promise.all([
    supabase.from('posts').select(select).eq('moderation_status', 'approved').ilike('caption', `%${safe}%`).order('created_at', { ascending: false }).limit(20),
    supabase.from('posts').select(select).eq('moderation_status', 'approved').contains('hashtags', [safe.toLowerCase()]).order('created_at', { ascending: false }).limit(20),
  ])
  if (captionResult.error) throw captionResult.error
  if (hashtagResult.error) throw hashtagResult.error
  const rows = [...(captionResult.data ?? []), ...(hashtagResult.data ?? [])] as unknown as Array<Record<string, unknown>>
  const uniqueRows = [...new Map(rows.map((row) => [String(row.id), row])).values()]
  const ids = uniqueRows.map((row) => row.id as string)
  if (!ids.length) return []
  const [likedResult, savedResult] = await Promise.all([
    supabase.from('likes').select('post_id').eq('user_id', userId).in('post_id', ids),
    supabase.from('saved_posts').select('post_id').eq('user_id', userId).in('post_id', ids),
  ])
  if (likedResult.error) throw likedResult.error
  if (savedResult.error) throw savedResult.error
  const liked = new Set((likedResult.data ?? []).map((row) => row.post_id as string))
  const saved = new Set((savedResult.data ?? []).map((row) => row.post_id as string))
  return Promise.all(uniqueRows.map(async (row) => {
    const { data: signed } = await supabase!.storage.from('loop-videos').createSignedUrl(row.video_path as string, 60 * 45)
    return {
      id: row.id as string, user_id: row.user_id as string, caption: row.caption as string, hashtags: (row.hashtags as string[]) ?? [],
      video_path: row.video_path as string, video_url: signed?.signedUrl ?? '', duration_seconds: Number(row.duration_seconds),
      created_at: row.created_at as string, visibility: row.visibility as Post['visibility'], moderation_status: row.moderation_status as Post['moderation_status'],
      profile: row.profiles as Profile, likes_count: readCount(row.likes), comments_count: readCount(row.comments), liked_by_me: liked.has(row.id as string), saved_by_me: saved.has(row.id as string),
    }
  }))
}

export async function getSuggestedCreators(userId: string): Promise<Profile[]> {
  if (!supabase || userId === 'demo-user') {
    return [...new Map(demoPosts.map((post) => [post.profile.id, post.profile])).values()]
  }
  const { data, error } = await supabase.from('profiles').select(PROFILE_SELECT).neq('id', userId).order('created_at', { ascending: false }).limit(6)
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function getTrendingTags(): Promise<Array<{ tag: string; count: string; note: string }>> {
  if (!supabase) {
    const counts = new Map<string, number>()
    demoPosts.forEach((post) => (post.hashtags ?? []).forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag, count]) => ({ tag, count: `${count} loops`, note: 'A little moment worth sharing' }))
  }
  const { data, error } = await supabase.from('posts').select('hashtags').eq('moderation_status', 'approved').order('created_at', { ascending: false }).limit(100)
  if (error) throw error
  const counts = new Map<string, number>()
  ;(data ?? []).forEach((row) => ((row.hashtags as string[] | null) ?? []).forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)))
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag, count]) => ({ tag, count: `${count} ${count === 1 ? 'loop' : 'loops'}`, note: 'Trending on Loop' }))
}

export async function searchCreators(term: string): Promise<Profile[]> {
  if (!supabase) return []
  const safe = term.replace(/[^a-zA-Z0-9_. ]/g, ' ').trim()
  if (!safe) return []
  const { data, error } = await supabase.from('profiles').select(PROFILE_SELECT).or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`).limit(20)
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function getNotifications(userId: string): Promise<NotificationItem[]> {
  if (!supabase || userId === 'demo-user') return []
  const { data, error } = await supabase.from('notifications').select(`id,type,created_at,post_id,read_at,profiles!notifications_actor_id_fkey(${PROFILE_SELECT})`).eq('recipient_id', userId).order('created_at', { ascending: false }).limit(40)
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, actor: row.profiles as unknown as Profile })) as NotificationItem[]
}

export async function deleteNotification(notificationId: string, userId: string): Promise<void> {
  if (!supabase || userId === 'demo-user') return
  const { error } = await supabase.from('notifications').delete().eq('id', notificationId).eq('recipient_id', userId)
  if (error) throw error
}

export async function reportContent(reporterId: string, targetType: 'post' | 'user' | 'comment', targetId: string, reason: string, details: string): Promise<void> {
  if (!supabase || reporterId === 'demo-user') return
  const { error } = await supabase.from('reports').insert({ reporter_id: reporterId, target_type: targetType, target_id: targetId, reason, details: details.trim() || null })
  if (error) throw error
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  if (!supabase || blockerId === 'demo-user') return
  const { error } = await supabase.rpc('block_user', { p_blocked_id: blockedId })
  if (error) throw error
}

export async function updateProfile(profileId: string, updates: Pick<Profile, 'display_name' | 'username' | 'bio' | 'is_private'>): Promise<void> {
  if (!supabase || profileId === 'demo-user') return
  const { error } = await supabase.from('profiles').update(updates).eq('id', profileId)
  if (error) throw error
}

export async function createPost(userId: string, file: File, caption: string, duration: number, visibility: Post['visibility']): Promise<void> {
  if (!supabase || userId === 'demo-user') throw new Error('Connect Supabase to publish videos. The preview account cannot upload.')
  const extension = file.name.split('.').pop()?.toLowerCase() || 'mp4'
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage.from('loop-videos').upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' })
  if (uploadError) throw uploadError
  const { error: insertError } = await supabase.from('posts').insert({
    user_id: userId, video_path: path, caption: caption.trim(), hashtags: extractHashtags(caption), duration_seconds: Math.round(duration * 100) / 100, visibility,
  })
  if (insertError) {
    await supabase.storage.from('loop-videos').remove([path])
    throw insertError
  }
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('is_admin')
  if (error) return false
  return Boolean(data)
}

export async function getModerationQueue(): Promise<{ reports: Array<Record<string, unknown>>; posts: Array<Record<string, unknown>> }> {
  if (!supabase) return { reports: [], posts: [] }
  const [reportsResult, postsResult] = await Promise.all([
    supabase.from('reports').select('id,target_type,target_id,reason,details,status,created_at,reporter_id').eq('status', 'open').order('created_at', { ascending: false }).limit(50),
    supabase.from('posts').select(`id,user_id,caption,video_path,created_at,moderation_status,profiles!posts_user_id_fkey(username,display_name)`).eq('moderation_status', 'review').order('created_at', { ascending: false }).limit(50),
  ])
  if (reportsResult.error) throw reportsResult.error
  if (postsResult.error) throw postsResult.error
  return { reports: reportsResult.data ?? [], posts: postsResult.data ?? [] }
}

export async function resolveReport(reportId: string, status: 'reviewed' | 'dismissed'): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('reports').update({ status }).eq('id', reportId)
  if (error) throw error
}

export async function moderatePost(postId: string, status: 'approved' | 'removed' | 'review'): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('posts').update({ moderation_status: status }).eq('id', postId)
  if (error) throw error
}

export async function moderateComment(commentId: string, status: 'approved' | 'removed' | 'review'): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('comments').update({ moderation_status: status }).eq('id', commentId)
  if (error) throw error
}

export async function moderateUser(userId: string, suspended: boolean): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('profiles').update({ is_suspended: suspended }).eq('id', userId)
  if (error) throw error
}

export async function getCounts(profileId: string): Promise<{ posts: number; followers: number; following: number }> {
  if (!supabase) return { posts: demoPosts.filter((post) => post.user_id === profileId).length, followers: 128, following: 92 }
  const { data, error } = await supabase.rpc('get_profile_counts', { p_profile_id: profileId })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return { posts: Number(row?.posts_count ?? 0), followers: Number(row?.followers_count ?? 0), following: Number(row?.following_count ?? 0) }
}

export async function getFollowStatus(targetId: string, userId: string): Promise<'accepted' | 'pending' | null> {
  if (!supabase || userId === 'demo-user') return null
  const { data, error } = await supabase.from('follows').select('status').eq('follower_id', userId).eq('following_id', targetId).maybeSingle()
  if (error) throw error
  return data?.status === 'accepted' || data?.status === 'pending' ? data.status : null
}

export async function promoteAdmin(email: string): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('promote_user_to_admin', { p_email: email.trim() })
  if (error) throw error
  return Boolean(data)
}

export async function acceptFollowRequest(followerId: string, recipientId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('follows').update({ status: 'accepted' }).eq('follower_id', followerId).eq('following_id', recipientId).eq('status', 'pending')
  if (error) throw error
}

export async function ignoreFollowRequest(followerId: string, recipientId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('follows').delete().eq('follower_id', followerId).eq('following_id', recipientId).eq('status', 'pending')
  if (error) throw error
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!supabase || userId === 'demo-user') throw new Error('Connect Supabase to upload a profile photo.')
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use a JPG, PNG or WebP image.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Profile photos must be 5 MB or smaller.')
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage.from('loop-avatars').upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' })
  if (uploadError) throw uploadError
  const { data } = supabase.storage.from('loop-avatars').getPublicUrl(path)
  const { error: updateError } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', userId)
  if (updateError) throw updateError
  return data.publicUrl
}

export async function getConnections(profileId: string, kind: 'followers' | 'following'): Promise<Profile[]> {
  if (!supabase) {
    const linked = demoPosts.map((post) => post.profile).filter((item) => item.id !== profileId)
    return linked
  }
  if (kind === 'followers') {
    const { data, error } = await supabase.from('follows').select(`profiles!follows_follower_id_fkey(${PROFILE_SELECT})`).eq('following_id', profileId).eq('status', 'accepted').limit(100)
    if (error) throw error
    return (data ?? []).map((row) => row.profiles as unknown as Profile).filter(Boolean)
  }
  const { data, error } = await supabase.from('follows').select(`profiles!follows_following_id_fkey(${PROFILE_SELECT})`).eq('follower_id', profileId).eq('status', 'accepted').limit(100)
  if (error) throw error
  return (data ?? []).map((row) => row.profiles as unknown as Profile).filter(Boolean)
}

export async function getBlockedProfiles(userId: string): Promise<Profile[]> {
  if (!supabase || userId === 'demo-user') return []
  const { data, error } = await supabase.from('blocks').select(`profiles!blocks_blocked_id_fkey(${PROFILE_SELECT})`).eq('blocker_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => row.profiles as unknown as Profile).filter(Boolean)
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  if (!supabase || blockerId === 'demo-user') return
  const { error } = await supabase.from('blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId)
  if (error) throw error
}
