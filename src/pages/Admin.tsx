
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, CheckCheck, Eye, Flag, ShieldCheck, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { isCurrentUserAdmin, getModerationQueue, moderatePost, moderateComment, moderateUser, resolveReport, promoteAdmin } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'

type QueueData = { reports: Array<Record<string, unknown>>; posts: Array<Record<string, unknown>> }

export function AdminPage() {
  const { configured } = useAuth()
  const [admin, setAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const [queue, setQueue] = useState<QueueData>({ reports: [], posts: [] })
  const [loading, setLoading] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)
  const refresh = useCallback(async () => {
    setLoading(true)
    try { setQueue(await getModerationQueue()) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load the moderation queue.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    let alive = true
    isCurrentUserAdmin().then((value) => { if (alive) { setAdmin(value); setChecking(false); if (value) void refresh() } })
    return () => { alive = false }
  }, [refresh])

  const reviewReport = async (id: string, status: 'reviewed' | 'dismissed') => {
    try { await resolveReport(id, status); setQueue((old) => ({ ...old, reports: old.reports.filter((report) => report.id !== id) })); toast.success(status === 'reviewed' ? 'Report marked as reviewed.' : 'Report dismissed.') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update report.') }
  }

  const actOnReport = async (report: Record<string, unknown>) => {
    const id = String(report.id)
    const targetId = String(report.target_id)
    const targetType = String(report.target_type)
    try {
      if (targetType === 'post') {
        await moderatePost(targetId, 'removed')
        toast.success('Reported loop removed and report reviewed.')
      } else if (targetType === 'comment') {
        await moderateComment(targetId, 'removed')
        toast.success('Reported comment hidden and report reviewed.')
      } else if (targetType === 'user') {
        await moderateUser(targetId, true)
        toast.success('Account suspended and report reviewed.')
      }
      await resolveReport(id, 'reviewed')
      setQueue((old) => ({ ...old, reports: old.reports.filter((item) => item.id !== id) }))
      if (targetType === 'post') setQueue((old) => ({ ...old, posts: old.posts.filter((item) => item.id !== targetId) }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not complete the moderation action.')
    }
  }
  const addAdmin = async () => {
    if (!adminEmail.trim()) return
    setAddingAdmin(true)
    try {
      const added = await promoteAdmin(adminEmail)
      if (added) { toast.success('Admin role granted.'); setAdminEmail('') }
      else toast.error('No Loop account was found for that email.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add admin.') }
    finally { setAddingAdmin(false) }
  }

  const takeDown = async (id: string) => {
    try { await moderatePost(id, 'removed'); setQueue((old) => ({ ...old, posts: old.posts.filter((post) => post.id !== id) })); toast.success('Loop removed from the feed.') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not remove loop.') }
  }
  const approve = async (id: string) => {
    try { await moderatePost(id, 'approved'); setQueue((old) => ({ ...old, posts: old.posts.filter((post) => post.id !== id) })); toast.success('Loop approved.') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not approve loop.') }
  }

  if (checking) return <div className="content-page"><div className="profile-skeleton" /></div>
  if (!configured || !admin) return <div className="content-page admin-page"><div className="page-heading-block"><span className="eyebrow"><ShieldCheck size={13} /> LOOP TRUST & SAFETY</span><h1>Safety <em>first.</em></h1><p>The admin tools that help keep the community healthy.</p></div><div className="admin-locked"><div className="admin-lock-icon"><ShieldCheck size={28} /></div><h2>{!configured ? 'Admin tools need a connected project.' : 'This area is for authorised admins.'}</h2><p>{!configured ? 'Connect Supabase, apply the database schema, and assign your first admin account using the setup guide.' : 'Your account does not have admin permissions. If you believe this is a mistake, contact the platform owner.'}</p><Link className="outline-button" to="/settings">Back to settings</Link></div></div>

  return <div className="content-page admin-page"><div className="page-heading-block"><span className="eyebrow"><ShieldCheck size={13} /> LOOP TRUST & SAFETY</span><h1>Safety <em>first.</em></h1><p>Review reports and content that needs a second look.</p></div><div className="admin-welcome"><div><span className="eyebrow">ADMIN CONSOLE</span><h2>Community overview</h2><p>Moderate thoughtfully. Use the least restrictive action that resolves a report.</p></div><div className="admin-status"><span className="status-dot" /> ADMIN ACCESS ACTIVE</div></div><div className="admin-stat-grid"><div className="admin-stat"><span>OPEN REPORTS</span><strong>{queue.reports.length}</strong><small><Flag size={13} /> Needs review</small></div><div className="admin-stat"><span>CONTENT IN REVIEW</span><strong>{queue.posts.length}</strong><small><Eye size={13} /> Awaiting decision</small></div><div className="admin-stat"><span>MODERATION MODE</span><strong className="admin-mode-label">COMMUNITY</strong><small><Users size={13} /> Human-led review</small></div></div>
    <section className="admin-section"><div className="admin-section-head"><div><span className="eyebrow">COMMUNITY CARE</span><h2><Flag size={18} /> Open reports</h2></div><button className="outline-button" onClick={() => void refresh()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh queue'}</button></div>{queue.reports.length ? <div className="moderation-list">{queue.reports.map((report) => <div className="moderation-item" key={String(report.id)}><div className="moderation-icon"><AlertTriangle size={18} /></div><div className="moderation-info"><strong>{String(report.reason)}</strong><span>{String(report.target_type)} · submitted {new Date(String(report.created_at)).toLocaleString()}</span>{typeof report.details === 'string' && report.details.length > 0 && <p>{report.details}</p>}</div><div className="moderation-actions"><button className="mini-action" onClick={() => void reviewReport(String(report.id), 'dismissed')}>Dismiss</button><button className="mini-action approved-action" onClick={() => void actOnReport(report)}>{report.target_type === 'user' ? <ShieldCheck size={14} /> : <Trash2 size={14} />}{report.target_type === 'user' ? 'Suspend' : report.target_type === 'comment' ? 'Hide comment' : 'Remove loop'}</button></div></div>)}</div> : <div className="admin-empty"><CheckCheck size={23} /><strong>All clear for now.</strong><span>There are no open reports in the queue.</span></div>}</section>
    <section className="admin-section"><div className="admin-section-head"><div><span className="eyebrow">CONTENT REVIEW</span><h2><Eye size={18} /> Loops to review</h2></div><span className="queue-count">{queue.posts.length} IN QUEUE</span></div>{queue.posts.length ? <div className="moderation-list">{queue.posts.map((post) => { const creator = post.profiles as { username?: string; display_name?: string } | null; return <div className="moderation-item" key={String(post.id)}><div className="moderation-icon"><AlertTriangle size={18} /></div><div className="moderation-info"><strong>{String(post.caption || 'No caption')}</strong><span>by @{creator?.username ?? 'unknown'} · {new Date(String(post.created_at)).toLocaleDateString()}</span></div><div className="moderation-actions"><button className="mini-action" onClick={() => void takeDown(String(post.id))}><Trash2 size={14} /> Remove</button><button className="mini-action approved-action" onClick={() => void approve(String(post.id))}><Check size={14} /> Approve</button></div></div>})}</div> : <div className="admin-empty"><CheckCheck size={23} /><strong>No content waiting.</strong><span>Flagged loops will appear here for review.</span></div>}</section>
    <section className="admin-section admin-add-admin"><div className="admin-section-head"><div><span className="eyebrow">TEAM ACCESS</span><h2><Users size={18} /> Add another admin</h2></div></div><div className="add-admin-row"><input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="Existing Loop account email" /><button className="primary-button" onClick={() => void addAdmin()} disabled={!adminEmail.trim() || addingAdmin}>{addingAdmin ? 'Adding…' : 'Grant admin access'}</button></div><p className="admin-helper">Only an existing administrator can promote another registered account. Admin access gives broad moderation privileges.</p></section>
    <div className="admin-warning"><AlertTriangle size={16} /><span>Never expose a service-role key in the browser. Admin actions are checked again by the database.</span></div>
  </div>
}
