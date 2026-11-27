import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Flame, Sparkles, Users, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { getFeed, getFollowingStates, followUser, unfollowUser, toggleLike, toggleSave, blockUser, getSuggestedCreators, getTrendingTags } from '../lib/api'
import type { Post, Profile } from '../lib/types'
import { VideoCard } from '../components/VideoCard'
import { CommentDrawer } from '../components/CommentDrawer'
import { ReportModal } from '../components/ReportModal'

export function FeedPage() {
  const { user, configured } = useAuth()
  const [tab, setTab] = useState<'for-you' | 'following'>('for-you')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [reportedPost, setReportedPost] = useState<Post | null>(null)
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [pendingFollowIds, setPendingFollowIds] = useState<Set<string>>(new Set())
  const [suggestedCreators, setSuggestedCreators] = useState<Profile[]>([])
  const [trendingTags, setTrendingTags] = useState<Array<{ tag: string; count: string; note: string }>>([])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try { setPosts(await getFeed(user.id, tab)) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load the feed.') }
    finally { setLoading(false) }
  }, [user, tab])

  useEffect(() => {
    let alive = true
    if (!user) { setFollowingIds(new Set()); setPendingFollowIds(new Set()); return }
    getFollowingStates(user.id).then((states) => { if (alive) { setFollowingIds(new Set(states.accepted)); setPendingFollowIds(new Set(states.pending)) } }).catch((error) => { if (alive) toast.error(error instanceof Error ? error.message : 'Could not load your following list.') })
    return () => { alive = false }
  }, [user])

  useEffect(() => {
    let alive = true
    Promise.all([getSuggestedCreators(user?.id ?? 'demo-user'), getTrendingTags()])
      .then(([creators, tags]) => {
        if (alive) { setSuggestedCreators(creators); setTrendingTags(tags) }
      })
      .catch((error) => { if (alive) toast.error(error instanceof Error ? error.message : 'Could not load recommendations.') })
    return () => { alive = false }
  }, [user])

  useEffect(() => { void load() }, [load])
  useEffect(() => { const refresh = () => { void load() }; window.addEventListener('loop:refresh-feed', refresh); return () => window.removeEventListener('loop:refresh-feed', refresh) }, [load])

  const like = async (post: Post) => {
    try {
      const next = await toggleLike(post, user?.id ?? 'demo-user')
      setPosts((items) => items.map((item) => item.id === post.id ? { ...item, liked_by_me: next, likes_count: Math.max(0, item.likes_count + (next ? 1 : -1)) } : item))
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update like.') }
  }
  const save = async (post: Post) => {
    try {
      const next = await toggleSave(post, user?.id ?? 'demo-user')
      setPosts((items) => items.map((item) => item.id === post.id ? { ...item, saved_by_me: next } : item))
      toast.success(next ? 'Saved to your collection.' : 'Removed from saved.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save this loop.') }
  }
  const follow = async (post: Post) => {
    if (!user || post.user_id === user.id) return
    try {
      if (followingIds.has(post.user_id) || pendingFollowIds.has(post.user_id)) {
        await unfollowUser(post.user_id, user.id)
        setFollowingIds((old) => { const next = new Set(old); next.delete(post.user_id); return next })
        setPendingFollowIds((old) => { const next = new Set(old); next.delete(post.user_id); return next })
        toast.success('Follow removed.')
      } else {
        await followUser(post.user_id, user.id)
        if (post.profile.is_private) {
          setPendingFollowIds((old) => new Set(old).add(post.user_id))
          toast.success('Follow request sent.')
        } else {
          setFollowingIds((old) => new Set(old).add(post.user_id))
          toast.success('You are now following this creator.')
        }
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update follow.') }
  }

  const block = async (post: Post) => {
    if (!user || post.user_id === user.id) return
    if (!window.confirm(`Block @${post.profile.username}? You will no longer see each other's content.`)) return
    try { await blockUser(user.id, post.user_id); setPosts((items) => items.filter((item) => item.user_id !== post.user_id)); toast.success(`@${post.profile.username} has been blocked.`) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not block this creator.') }
  }

  return (
    <div className="feed-layout">
      <main className="feed-main">
        <div className="page-intro feed-intro">
          <div><span className="eyebrow"><span className="live-dot" /> YOUR DAILY DOSE OF LOOP</span><h1>Good things <em>happen</em><br className="desktop-break" /> in a loop<span className="lime-dot">.</span></h1><p>Ten seconds. One moment. Infinite ways to see it.</p></div>
          <div className="intro-orbit"><div className="orbit-ring orbit-a" /><div className="orbit-ring orbit-b" /><span>10<span>s</span></span></div>
        </div>
        {!configured && <div className="preview-banner"><Sparkles size={16} /><span><strong>Preview mode</strong> — explore the experience now. Connect Supabase to enable real accounts and uploads.</span><Link to="/settings">Setup guide <ArrowUpRight size={14} /></Link></div>}
        <div className="feed-toolbar">
          <div className="feed-tabs"><button className={tab === 'for-you' ? 'selected' : ''} onClick={() => setTab('for-you')}><Sparkles size={15} /> For you</button><button className={tab === 'following' ? 'selected' : ''} onClick={() => setTab('following')}><Users size={15} /> Following</button></div>
          <span className="feed-refresh-label"><span className="status-dot" /> FRESH LOOPS</span>
        </div>
        {loading ? <div className="feed-skeleton"><div /><div /><div /></div> : posts.length ? <div className="video-feed">{posts.map((post) => <VideoCard key={post.id} post={post} onLike={like} onSave={save} onComments={setSelectedPost} onFollow={follow} onReport={setReportedPost} onBlock={block} following={followingIds.has(post.user_id)} followPending={pendingFollowIds.has(post.user_id)} />)}</div> : <div className="empty-state feed-empty"><div className="empty-icon"><Users size={24} /></div><h3>{tab === 'following' ? 'Your circle is waiting.' : 'It is quiet in here.'}</h3><p>{tab === 'following' ? 'Follow a few creators and their loops will show up here.' : 'Be the first to share a moment with the community.'}</p><button className="primary-button" onClick={() => tab === 'following' ? setTab('for-you') : window.dispatchEvent(new Event('loop:upload'))}>{tab === 'following' ? 'Explore the feed' : 'Post your first loop'} <ArrowUpRight size={15} /></button></div>}
        <div className="feed-endnote"><span className="endnote-mark">✳</span><span>YOU'RE ALL CAUGHT UP</span><span className="endnote-line" /></div>
      </main>
      <aside className="right-rail">
        <div className="right-rail-head"><span className="eyebrow">THE LOOP EDIT</span><span className="edit-spark">✳</span></div>
        <section className="rail-feature">
          <div className="feature-art"><div className="feature-sun" /><div className="feature-label">10 SEC<br />SPOTLIGHT</div><span className="feature-number">01</span></div>
          <div className="rail-card-copy"><span className="eyebrow">THIS WEEK'S MOOD</span><h3>Small moments.<br /><em>Big energy.</em></h3><p>Find the beauty in the bits between the big things.</p></div>
        </section>
        <section className="rail-section"><div className="rail-section-title"><h3><Flame size={16} /> Trending tags</h3><button onClick={() => window.location.assign('/explore')}>See all <ChevronRight size={14} /></button></div><div className="trending-tags">{trendingTags.slice(0, 4).map((item) => <Link to={`/explore?tag=${encodeURIComponent(item.tag)}`} key={item.tag}>#{item.tag} <span>{item.count}</span></Link>)}{!trendingTags.length && <span className="rail-empty">Tags will appear as creators post.</span>}</div></section>
        <section className="rail-section creators-rail"><div className="rail-section-title"><h3><Sparkles size={16} /> Creators to know</h3><Link to="/explore">Explore <ChevronRight size={14} /></Link></div>{suggestedCreators.slice(0, 3).map((creator) => <Link className="creator-suggestion" to={`/@${creator.username}`} key={creator.id}><div className="avatar">{creator.avatar_url ? <img src={creator.avatar_url} alt="" /> : creator.display_name.slice(0, 1)}</div><div><strong>{creator.display_name}</strong><span>@{creator.username}</span></div><span className="suggestion-arrow"><ArrowUpRight size={15} /></span></Link>)}{!suggestedCreators.length && <span className="rail-empty">New creators will appear here.</span>}</section>
        <div className="rail-footer"><span>ABOUT</span><span>COMMUNITY GUIDELINES</span><span>PRIVACY</span><span>© LOOP 2026</span></div>
      </aside>
      <CommentDrawer post={selectedPost} onClose={() => setSelectedPost(null)} onCommented={() => setPosts((items) => items.map((item) => item.id === selectedPost?.id ? { ...item, comments_count: item.comments_count + 1 } : item))} />
      <ReportModal post={reportedPost} onClose={() => setReportedPost(null)} />
    </div>
  )
}
