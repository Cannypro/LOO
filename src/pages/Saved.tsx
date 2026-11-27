import { useEffect, useState } from 'react'
import { Bookmark, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { getSavedPosts, toggleLike, toggleSave, blockUser } from '../lib/api'
import type { Post } from '../lib/types'
import { VideoCard } from '../components/VideoCard'
import { CommentDrawer } from '../components/CommentDrawer'
import { ReportModal } from '../components/ReportModal'

export function SavedPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [selected, setSelected] = useState<Post | null>(null)
  const [reported, setReported] = useState<Post | null>(null)
  useEffect(() => {
    if (!user) return
    getSavedPosts(user.id).then(setPosts).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not load saved loops.'))
  }, [user])
  const like = async (post: Post) => {
    try { const next = await toggleLike(post, user?.id ?? 'demo-user'); setPosts((items) => items.map((item) => item.id === post.id ? { ...item, liked_by_me: next, likes_count: item.likes_count + (next ? 1 : -1) } : item)) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update like.') }
  }
  const block = async (post: Post) => {
    if (!user || post.user_id === user.id) return
    if (!window.confirm(`Block @${post.profile.username}? You will no longer see each other's content.`)) return
    try { await blockUser(user.id, post.user_id); setPosts((items) => items.filter((item) => item.user_id !== post.user_id)); toast.success('Creator blocked.') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not block creator.') }
  }
  const save = async (post: Post) => {
    try { await toggleSave(post, user?.id ?? 'demo-user'); setPosts((items) => items.filter((item) => item.id !== post.id)); toast.success('Removed from saved loops.') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update saved loops.') }
  }
  return <div className="content-page saved-page"><div className="page-heading-block"><span className="eyebrow"><Bookmark size={13} /> YOUR PERSONAL COLLECTION</span><h1>Kept close<span className="lime-dot">.</span></h1><p>The loops worth coming back to.</p></div>{posts.length ? <div className="saved-feed">{posts.map((post) => <VideoCard key={post.id} post={post} onLike={like} onSave={save} onComments={setSelected} onFollow={() => undefined} onReport={setReported} onBlock={block} showFollow={false} />)}</div> : <div className="empty-state page-empty"><div className="empty-icon"><Sparkles size={23} /></div><h3>Your collection starts here.</h3><p>Save a loop from the feed and it will be waiting for you here.</p></div>}<CommentDrawer post={selected} onClose={() => setSelected(null)} onCommented={() => setPosts((items) => items.map((item) => item.id === selected?.id ? { ...item, comments_count: item.comments_count + 1 } : item))} /><ReportModal post={reported} onClose={() => setReported(null)} /></div>
}
