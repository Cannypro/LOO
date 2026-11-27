import { useState } from 'react'
import { Flag, X } from 'lucide-react'
import { toast } from 'sonner'
import { reportContent } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import type { Post } from '../lib/types'

const reasons = ['Spam or misleading', 'Bullying or harassment', 'Hate or abusive content', 'Privacy concern', 'Inappropriate for the community', 'Copyright or impersonation', 'Something else']

type ReportTarget = { type: 'user' | 'post' | 'comment'; id: string; label: string }

export function ReportModal({ post, target, onClose }: { post: Post | null; target?: ReportTarget | null; onClose: () => void }) {
  const { user } = useAuth()
  const [reason, setReason] = useState(reasons[0])
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)
  if (!post && !target) return null
  const targetType = target?.type ?? 'post'
  const targetId = target?.id ?? post!.id
  const targetLabel = target?.label ?? `@${post!.profile.username}`

  const submit = async () => {
    if (!user) return
    setSending(true)
    try {
      await reportContent(user.id, targetType, targetId, reason, details)
      toast.success('Thanks. Your report has been submitted.')
      onClose()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not submit report.') }
    finally { setSending(false) }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <div className="modal-heading"><div><span className="eyebrow">HELP KEEP LOOP SAFE</span><h2 id="report-title">Report {targetType === 'user' ? 'an account' : targetType === 'comment' ? 'a comment' : 'a loop'}<span className="lime-dot">.</span></h2></div><button className="close-button" onClick={onClose}><X size={19} /></button></div>
        <p className="muted-copy">You're reporting <strong>{targetLabel}</strong>. Your report is private. Our moderation team can review it under the community guidelines.</p>
        <label className="field-label">WHY ARE YOU REPORTING THIS?</label>
        <div className="reason-list">{reasons.map((item) => <label className={`reason-option${reason === item ? ' selected' : ''}`} key={item}><input type="radio" name="reason" checked={reason === item} onChange={() => setReason(item)} /><span className="radio-dot" />{item}</label>)}</div>
        <label className="field-label" htmlFor="report-details">ANYTHING ELSE? <span className="optional-label">OPTIONAL</span></label>
        <textarea id="report-details" rows={3} maxLength={400} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Share a little more context…" />
        <div className="report-actions"><button className="text-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={submit} disabled={sending}><Flag size={15} /> {sending ? 'Sending…' : 'Submit report'}</button></div>
      </section>
    </div>
  )
}
