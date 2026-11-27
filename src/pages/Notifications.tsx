import { useEffect, useState } from 'react'
import { Bell, Heart, MessageCircle, UserRoundPlus, UserRoundCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { getNotifications, acceptFollowRequest, ignoreFollowRequest, deleteNotification } from '../lib/api'
import type { NotificationItem } from '../lib/types'

function ago(date: string) {
  const diff = Math.max(0, Date.now() - new Date(date).getTime())
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function NotificationsPage() {
  const { user, configured } = useAuth()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [workingId, setWorkingId] = useState<string | null>(null)
  useEffect(() => {
    if (!user) return
    getNotifications(user.id).then(setItems).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not load activity.'))
  }, [user])
  const respondToRequest = async (item: NotificationItem, accept: boolean) => {
    if (!user) return
    setWorkingId(item.id)
    try {
      if (accept) await acceptFollowRequest(item.actor.id, user.id)
      else await ignoreFollowRequest(item.actor.id, user.id)
      await deleteNotification(item.id, user.id)
      setItems((old) => old.filter((entry) => entry.id !== item.id))
      toast.success(accept ? `You and @${item.actor.username} are connected.` : 'Follow request declined.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update follow request.') }
    finally { setWorkingId(null) }
  }
  const iconFor = (type: NotificationItem['type']) => type === 'like' ? <Heart size={17} /> : type === 'comment' ? <MessageCircle size={17} /> : type === 'follow_request' ? <UserRoundCheck size={17} /> : <UserRoundPlus size={17} />
  const sentenceFor = (item: NotificationItem) => item.type === 'like' ? 'liked your loop.' : item.type === 'comment' ? 'commented on your loop.' : item.type === 'follow_request' ? 'requested to follow you.' : 'started following you.'
  return <div className="content-page notifications-page"><div className="page-heading-block"><span className="eyebrow"><Bell size={13} /> GOOD THINGS HAPPEN HERE</span><h1>You're in the <em>loop.</em></h1><p>All the little signals that someone noticed your moment.</p></div><div className="activity-panel"><div className="activity-panel-head"><div><span className="eyebrow">YOUR ACTIVITY</span><h2>Recent moments</h2></div><span className="activity-live"><i /> RECENT ACTIVITY</span></div>{items.length ? <div className="activity-list">{items.map((item) => <div className="activity-row" key={item.id}><div className={`activity-type-icon type-${item.type}`}>{iconFor(item.type)}</div><div className="avatar">{item.actor.avatar_url ? <img src={item.actor.avatar_url} alt="" /> : item.actor.display_name.slice(0, 1)}</div><div className="activity-message"><p><Link to={`/@${item.actor.username}`}>{item.actor.username}</Link> {sentenceFor(item)}</p><span>{ago(item.created_at)}</span></div>{item.type === 'follow_request' && <div className="request-actions"><button className="mini-action" disabled={workingId === item.id} onClick={() => void respondToRequest(item, false)}>Decline</button><button className="mini-action approved-action" disabled={workingId === item.id} onClick={() => void respondToRequest(item, true)}>{workingId === item.id ? '…' : 'Accept'}</button></div>}</div>)}</div> : <div className="empty-state activity-empty"><div className="empty-icon"><Sparkles size={23} /></div><h3>It's a fresh start.</h3><p>{configured ? 'When people interact with your loops, you will see it here.' : 'Connect Supabase to enable account activity and real notifications.'}</p></div>}</div></div>
}
