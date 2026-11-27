import { useRef, useState } from 'react'
import { Clapperboard, Upload, X, Lock, Globe2, Users, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { createPost } from '../lib/api'
import type { Post } from '../lib/types'

export function UploadModal({ open, onClose, onPublished }: { open: boolean; onClose: () => void; onPublished: () => void }) {
  const { user, configured } = useAuth()
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [duration, setDuration] = useState(0)
  const [caption, setCaption] = useState('')
  const [visibility, setVisibility] = useState<Post['visibility']>('public')
  const [checking, setChecking] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null); setPreview(''); setDuration(0); setCaption(''); setVisibility('public'); setChecking(false)
  }
  const close = () => { reset(); onClose() }

  const chooseFile = (picked: File | undefined) => {
    if (!picked) return
    if (!picked.type.startsWith('video/')) { toast.error('Choose a video file.'); return }
    if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(picked.type)) { toast.error('For now, use MP4, WebM or MOV.'); return }
    if (picked.size > 80 * 1024 * 1024) { toast.error('This video is larger than 80 MB.'); return }
    const url = URL.createObjectURL(picked)
    setChecking(true)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const seconds = video.duration
      setChecking(false)
      if (!Number.isFinite(seconds) || seconds <= 0) { URL.revokeObjectURL(url); toast.error('We could not read this video. Try another file.'); return }
      if (seconds > 10.0) { URL.revokeObjectURL(url); toast.error(`This clip is ${seconds.toFixed(1)} seconds. Loops must be 10 seconds or less.`); return }
      if (preview) URL.revokeObjectURL(preview)
      setFile(picked); setPreview(url); setDuration(seconds)
    }
    video.onerror = () => { URL.revokeObjectURL(url); setChecking(false); toast.error('We could not open this video.'); }
    video.src = url
  }

  const publish = async () => {
    if (!file || !user) { toast.error('Choose a clip first.'); return }
    setPublishing(true)
    try {
      await createPost(user.id, file, caption, duration, visibility)
      toast.success('Your loop has been sent for review.')
      onPublished()
      close()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not publish this loop.')
    } finally { setPublishing(false) }
  }

  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
      <section className="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title">
        <div className="modal-heading"><div><span className="eyebrow">CREATE SOMETHING</span><h2 id="upload-title">Post a loop<span className="lime-dot">.</span></h2></div><button className="close-button" onClick={close} aria-label="Close"><X size={19} /></button></div>
        <div className="upload-layout">
          <div className={`upload-preview${preview ? ' has-preview' : ''}`}>
            {preview ? <video src={preview} controls muted playsInline /> : <><div className="upload-art"><div className="upload-art-ring ring-one" /><div className="upload-art-ring ring-two" /><Clapperboard size={39} /></div><strong>Make it a moment.</strong><span>Your video lives here.</span></>}
            <div className="duration-badge">{file ? `${duration.toFixed(1)} / 10s` : 'MAX 10 SECONDS'}</div>
          </div>
          <div className="upload-fields">
            <div className="field-label-row"><label>YOUR VIDEO</label><span>MP4 · MOV · WEBM · 80 MB max</span></div>
            <input ref={fileInput} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(event) => chooseFile(event.target.files?.[0])} />
            <button className="file-picker" onClick={() => fileInput.current?.click()} disabled={checking}><Upload size={18} /><span>{checking ? 'Checking your clip…' : file ? 'Choose a different video' : 'Choose video'}</span></button>
            <label className="field-label" htmlFor="caption">CAPTION</label>
            <textarea id="caption" maxLength={220} rows={3} placeholder="What is this moment about? Add #hashtags…" value={caption} onChange={(event) => setCaption(event.target.value)} />
            <div className="char-count">{caption.length}/220</div>
            <label className="field-label">WHO CAN SEE THIS?</label>
            <div className="visibility-options">
              <button className={visibility === 'public' ? 'selected' : ''} onClick={() => setVisibility('public')}><Globe2 size={16} /><span>Everyone</span></button>
              <button className={visibility === 'followers' ? 'selected' : ''} onClick={() => setVisibility('followers')}><Users size={16} /><span>Followers</span></button>
              <button className={visibility === 'private' ? 'selected' : ''} onClick={() => setVisibility('private')}><Lock size={16} /><span>Only me</span></button>
            </div>
            <div className="upload-note"><CheckCircle2 size={15} /> Keep it kind. Every loop follows our community guidelines.</div>
            {!configured && <div className="demo-warning">Preview mode: connect Supabase to publish real videos.</div>}
            <div className="upload-footer"><button className="text-button" onClick={close}>Cancel</button><button className="primary-button" disabled={!file || checking || publishing || !configured} onClick={publish}>{publishing ? 'Publishing…' : 'Share loop'} <span>↗</span></button></div>
          </div>
        </div>
        <p className="upload-legal">By posting, you confirm you have permission to share this video. Uploads are subject to review and community rules.</p>
      </section>
    </div>
  )
}
