import { useEffect, useRef, useState } from 'react'
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Volume2, VolumeX, Repeat2, Flag, UserRoundPlus, Check, UserX } from 'lucide-react'
import type { Post } from '../lib/types'

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return String(value)
}

export function VideoCard({
  post,
  onLike,
  onSave,
  onComments,
  onFollow,
  onReport,
  onBlock,
  following = false,
  followPending = false,
  showFollow = true,
}: {
  post: Post
  onLike: (post: Post) => void
  onSave: (post: Post) => void
  onComments: (post: Post) => void
  onFollow: (post: Post) => void
  onReport: (post: Post) => void
  onBlock: (post: Post) => void
  following?: boolean
  followPending?: boolean
  showFollow?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const [muted, setMuted] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [replaying, setReplaying] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    const node = cardRef.current
    if (!video || !node) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return
      if (entry.isIntersecting && entry.intersectionRatio > 0.55) {
        video.play().catch(() => undefined)
      } else {
        video.pause()
      }
    }, { threshold: [0, 0.55, 1] })
    observer.observe(node)
    return () => observer.disconnect()
  }, [post.video_url])

  const replay = () => {
    if (!videoRef.current) return
    videoRef.current.currentTime = 0
    videoRef.current.play().catch(() => undefined)
    setReplaying(true)
    window.setTimeout(() => setReplaying(false), 700)
  }

  return (
    <article ref={cardRef} className="video-card">
      <div className="video-topline">
        <span className="feed-kicker"><span className="kicker-dot" /> THE LOOP FEED</span>
        <span className="video-duration"><span className="duration-icon">◷</span> {Math.min(10, Math.round(post.duration_seconds * 10) / 10)}s</span>
      </div>
      <div className="video-stage">
        {post.video_url ? (
          <video
            ref={videoRef}
            className="loop-video"
            src={post.video_url}
            muted={muted}
            playsInline
            loop
            preload="metadata"
            onTimeUpdate={(event) => {
              const video = event.currentTarget
              if (post.duration_seconds > 0 && video.currentTime >= post.duration_seconds) video.currentTime = 0
            }}
            onClick={replay}
          />
        ) : <div className="video-unavailable"><ClapperboardFallback /><span>Video preview unavailable</span></div>}
        <div className="video-vignette" />
        <div className="video-overlay-top">
          <div className="now-playing"><span className="equalizer"><i /><i /><i /></span> LOOPING NOW</div>
          <button className="icon-glass" aria-label={muted ? 'Unmute video' : 'Mute video'} onClick={() => setMuted((value) => !value)}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
        </div>
        <div className="video-copy">
          <div className="creator-row">
            <div className="avatar avatar-small">{post.profile.avatar_url ? <img src={post.profile.avatar_url} alt="" /> : post.profile.display_name.slice(0, 1)}</div>
            <div className="creator-name-block"><strong>{post.profile.display_name}</strong><span>@{post.profile.username}</span></div>
            {showFollow && post.user_id !== 'demo-user' && <button className={`follow-pill${following || followPending ? ' following' : ''}`} onClick={() => onFollow(post)}>{following ? <><Check size={13} /> Following</> : followPending ? <><Check size={13} /> Requested</> : <><UserRoundPlus size={13} /> Follow</>}</button>}
          </div>
          <p className="video-caption">{post.caption}</p>
          {!!post.hashtags?.length && <div className="hashtag-line">{post.hashtags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
        </div>
        <button className="replay-hit" onClick={replay} aria-label="Replay video"><span className={replaying ? 'replay-icon replaying' : 'replay-icon'}><Repeat2 size={21} /></span></button>
      </div>
      <div className="video-actions">
        <button className={`action-button like-action${post.liked_by_me ? ' liked' : ''}`} onClick={() => onLike(post)}><Heart size={19} fill={post.liked_by_me ? 'currentColor' : 'none'} /><span>{formatCount(post.likes_count)}</span></button>
        <button className="action-button" onClick={() => onComments(post)}><MessageCircle size={19} /><span>{formatCount(post.comments_count)}</span></button>
        <button className={`action-button${post.saved_by_me ? ' saved' : ''}`} onClick={() => onSave(post)}><Bookmark size={18} fill={post.saved_by_me ? 'currentColor' : 'none'} /><span>Save</span></button>
        <div className="action-spacer" />
        <div className="more-wrap">
          <button className="more-button" onClick={() => setMenuOpen((value) => !value)} aria-label="More options"><MoreHorizontal size={20} /></button>
          {menuOpen && <div className="more-menu"><button onClick={() => { onReport(post); setMenuOpen(false) }}><Flag size={15} /> Report this loop</button><button onClick={() => { replay(); setMenuOpen(false) }}><Repeat2 size={15} /> Replay</button><button onClick={() => { onBlock(post); setMenuOpen(false) }}><UserX size={15} /> Block creator</button></div>}
        </div>
      </div>
      <div className="video-card-foot"><span>Posted {new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><span>10 SECONDS. ENDLESS POSSIBILITIES.</span></div>
    </article>
  )
}

function ClapperboardFallback() {
  return <div className="fallback-symbol"><Repeat2 size={27} /></div>
}
