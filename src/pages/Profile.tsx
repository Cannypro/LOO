import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowUpRight, Grid3X3, LockKeyhole, Settings2, UserRoundCheck, UserRoundPlus, Video, X, Users } from 'lucide-react'
import { toast } from 'sonner'
import { blockUser } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { getProfile, getProfilePosts, getCounts, getFollowStatus, followUser, unfollowUser, getConnections } from '../lib/api'
import type { Post, Profile } from '../lib/types'
import { ReportModal } from '../components/ReportModal'

export function ProfilePage() {
  const { username = '' } = useParams()
  const { user, profile: myProfile } = useAuth()
  const [creator, setCreator] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [counts, setCounts] = useState({ posts: 0, followers: 0, following: 0 })
  const [followStatus, setFollowStatus] = useState<'accepted' | 'pending' | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectionsOpen, setConnectionsOpen] = useState(false)
  const [connectionKind, setConnectionKind] = useState<'followers' | 'following'>('followers')
  const [connections, setConnections] = useState<Profile[]>([])
  const [connectionsLoading, setConnectionsLoading] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const isMine = Boolean(myProfile && myProfile.username === username.replace(/^@/, ''))

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const found = await getProfile(username)
      setCreator(found)
      if (found) {
        const [creatorPosts, creatorCounts, status] = await Promise.all([getProfilePosts(found.id, user.id), getCounts(found.id), getFollowStatus(found.id, user.id)])
        setPosts(creatorPosts); setCounts(creatorCounts); setFollowStatus(status)
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load this profile.') }
    finally { setLoading(false) }
  }, [username, user])

  useEffect(() => { void load() }, [load])

  const openConnections = async (kind: 'followers' | 'following') => {
    if (!creator) return
    setConnectionKind(kind); setConnectionsOpen(true); setConnectionsLoading(true)
    try { setConnections(await getConnections(creator.id, kind)) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load this list.') }
    finally { setConnectionsLoading(false) }
  }

  const blockCreator = async () => {
    if (!creator || !user || creator.id === user.id) return
    if (!window.confirm(`Block @${creator.username}? You will no longer see each other's content.`)) return
    try { await blockUser(user.id, creator.id); toast.success(`@${creator.username} has been blocked.`); window.location.assign('/explore') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not block this creator.') }
  }

  const toggleFollow = async () => {
    if (!creator || !user) return
    try {
      if (followStatus) {
        await unfollowUser(creator.id, user.id)
        if (followStatus === 'accepted') setCounts((old) => ({ ...old, followers: Math.max(0, old.followers - 1) }))
        setFollowStatus(null)
        toast.success('Follow removed.')
      } else {
        await followUser(creator.id, user.id)
        if (creator.is_private) { setFollowStatus('pending'); toast.success('Follow request sent.') }
        else { setFollowStatus('accepted'); setCounts((old) => ({ ...old, followers: old.followers + 1 })); toast.success('Following.') }
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update follow.') }
  }

  if (loading) return <div className="content-page"><div className="profile-skeleton" /></div>
  if (!creator) return <div className="content-page"><div className="empty-state page-empty"><div className="empty-icon"><Grid3X3 size={23} /></div><h3>Creator not found.</h3><p>This profile may be unavailable or the username may have changed.</p><Link className="primary-button" to="/explore">Explore creators <ArrowUpRight size={15} /></Link></div></div>

  return (
    <div className="content-page profile-page">
      <div className="profile-banner"><div className="profile-banner-lines" /><span className="profile-banner-word">LOOP<span>.</span></span><span className="profile-banner-tag">A LITTLE WORLD OF YOUR OWN</span></div>
      <section className="profile-header-card">
        <div className="profile-avatar-wrap"><div className="avatar profile-avatar">{creator.avatar_url ? <img src={creator.avatar_url} alt="" /> : creator.display_name.slice(0, 1)}</div><span className="profile-online-dot" /></div>
        <div className="profile-main-info"><div className="profile-name-line"><div><h1>{creator.display_name}</h1><span className="profile-username">@{creator.username}</span></div>{isMine ? <Link to="/settings" className="outline-button"><Settings2 size={15} /> Edit profile</Link> : <div className="profile-action-row"><button className={followStatus ? 'outline-button following-button' : 'primary-button'} onClick={() => void toggleFollow()}>{followStatus === 'accepted' ? <><UserRoundCheck size={16} /> Following</> : followStatus === 'pending' ? <><UserRoundCheck size={16} /> Requested</> : <><UserRoundPlus size={16} /> Follow</>}</button><button className="outline-button profile-more-action" onClick={() => setReportOpen(true)}>Report</button><button className="outline-button profile-more-action" onClick={() => void blockCreator()}>Block</button></div>}</div><p className="profile-bio">{creator.bio || 'A new face on Loop. Say hello.'}</p><div className="profile-stats"><div><strong>{counts.posts}</strong><span>loops</span></div><button onClick={() => void openConnections('followers')}><strong>{counts.followers.toLocaleString()}</strong><span>followers</span></button><button onClick={() => void openConnections('following')}><strong>{counts.following.toLocaleString()}</strong><span>following</span></button></div></div>
        {creator.is_private && <div className="private-account-note"><LockKeyhole size={14} /> Private account</div>}
      </section>
      <div className="profile-content-head"><div><Grid3X3 size={17} /><strong>LOOPS</strong></div><span>{posts.length} {posts.length === 1 ? 'moment' : 'moments'} shared</span></div>
      {posts.length ? <div className="profile-video-grid">{posts.map((post) => <Link to="/" className="profile-video-tile" key={post.id}><video src={post.video_url} muted playsInline loop preload="metadata" /><div className="tile-hover"><Video size={18} /><span>{post.likes_count.toLocaleString()} likes</span></div><span className="tile-duration">{Math.min(10, post.duration_seconds)}s</span>{post.moderation_status === 'review' && <span className="tile-review-badge">In review</span>}</Link>)}</div> : <div className="empty-state profile-empty"><div className="empty-icon"><Video size={24} /></div><h3>No loops yet.</h3><p>{isMine ? 'Your first moment is waiting to be shared.' : 'This creator has not shared any loops yet.'}</p></div>}
      <ReportModal post={null} target={creator && reportOpen ? { type: 'user', id: creator.id, label: `@${creator.username}` } : null} onClose={() => setReportOpen(false)} />
      {connectionsOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConnectionsOpen(false) }}><section className="connections-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><span className="eyebrow">THE COMMUNITY AROUND THIS CREATOR</span><h2>{connectionKind === 'followers' ? 'Followers' : 'Following'}<span className="lime-dot">.</span></h2></div><button className="close-button" onClick={() => setConnectionsOpen(false)}><X size={19} /></button></div>{connectionsLoading ? <div className="empty-inline">Loading people…</div> : connections.length ? <div className="connections-list">{connections.map((person) => <Link to={`/@${person.username}`} className="connection-person" key={person.id} onClick={() => setConnectionsOpen(false)}><div className="avatar">{person.avatar_url ? <img src={person.avatar_url} alt="" /> : person.display_name.slice(0, 1)}</div><div><strong>{person.display_name}</strong><span>@{person.username}</span></div><ArrowUpRight size={16} /></Link>)}</div> : <div className="empty-state compact-empty"><div className="empty-icon"><Users size={23} /></div><strong>No {connectionKind} to show.</strong><span>This list is empty for now.</span></div>}</section></div>}
    </div>
  )
}
