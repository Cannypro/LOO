import { useEffect, useState } from 'react'
import { ArrowUpRight, Flag, MessageCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { addComment, getComments } from '../lib/api'
import type { Comment, Post } from '../lib/types'
import { ReportModal } from './ReportModal'

export function CommentDrawer({ post, onClose, onCommented }: { post: Post | null; onClose: () => void; onCommented: () => void }) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [reportedComment, setReportedComment] = useState<Comment | null>(null)

  useEffect(() => {
    if (!post) return
    setLoading(true)
    getComments(post.id).then(setComments).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not load comments.')).finally(() => setLoading(false))
  }, [post?.id])

  const send = async () => {
    if (!post || !user || !body.trim()) return
    if (body.trim().length > 500) { toast.error('Comments must be 500 characters or fewer.'); return }
    setSending(true)
    try {
      await addComment(post.id, user.id, body)
      setBody('')
      onCommented()
      const refreshed = await getComments(post.id)
      setComments(refreshed)
      if (post.id.startsWith('demo-')) toast.info('Comments are preview-only until Supabase is connected.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not send comment.') }
    finally { setSending(false) }
  }

  if (!post) return null
  return (
    <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <aside className="comment-drawer" role="dialog" aria-modal="true" aria-label="Comments">
        <div className="drawer-head"><div><span className="eyebrow">THE CONVERSATION</span><h3>Comments <span>{post.comments_count}</span></h3></div><button className="close-button" onClick={onClose}><X size={19} /></button></div>
        <div className="comment-post-preview"><div className="avatar avatar-xs">{post.profile.avatar_url ? <img src={post.profile.avatar_url} alt="" /> : post.profile.display_name.slice(0, 1)}</div><span><strong>{post.profile.username}</strong> {post.caption}</span></div>
        <div className="comments-list">
          {loading ? <div className="empty-inline">Loading comments…</div> : comments.length ? comments.map((comment) => (
            <div className="comment-row" key={comment.id}><div className="avatar avatar-xs">{comment.profile.avatar_url ? <img src={comment.profile.avatar_url} alt="" /> : comment.profile.display_name.slice(0, 1)}</div><div className="comment-content"><p><strong>{comment.profile.username}</strong> {comment.body}</p><span>{new Date(comment.created_at).toLocaleDateString()}</span></div><button className="comment-report" onClick={() => setReportedComment(comment)} aria-label={`Report comment by ${comment.profile.username}`}><Flag size={14} /></button></div>
          )) : <div className="empty-state compact-empty"><div className="empty-icon"><MessageCircle size={23} /></div><strong>Start the conversation.</strong><span>Good vibes make good loops.</span></div>}
        </div>
        <div className="comment-compose"><input value={body} maxLength={500} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} placeholder="Add a thoughtful comment…" /><button onClick={send} disabled={!body.trim() || sending} aria-label="Send comment"><ArrowUpRight size={18} /></button></div>
        <p className="drawer-footnote">Keep it respectful. Comments can be reported if they cross the line.</p>
      </aside>
      <ReportModal post={null} target={reportedComment ? { type: 'comment', id: reportedComment.id, label: `a comment by @${reportedComment.profile.username}` } : null} onClose={() => setReportedComment(null)} />
    </div>
  )
}
