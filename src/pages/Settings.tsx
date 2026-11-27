import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleHelp, LockKeyhole, Save, ShieldCheck, UserRound, KeyRound, ExternalLink, Camera } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { isCurrentUserAdmin, updateProfile, uploadAvatar, getBlockedProfiles, unblockUser } from '../lib/api'
import { isSupabaseConfigured } from '../lib/supabase'

export function SettingsPage() {
  const { user, profile, refreshProfile, signOut, configured } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [username, setUsername] = useState(profile?.username ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [isPrivate, setIsPrivate] = useState(profile?.is_private ?? false)
  const [saving, setSaving] = useState(false)
  const [admin, setAdmin] = useState(false)
  const avatarInput = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [blockedUsers, setBlockedUsers] = useState<import('../lib/types').Profile[]>([])

  useEffect(() => {
    setDisplayName(profile?.display_name ?? ''); setUsername(profile?.username ?? ''); setBio(profile?.bio ?? ''); setIsPrivate(profile?.is_private ?? false)
  }, [profile])
  useEffect(() => { void isCurrentUserAdmin().then(setAdmin) }, [])
  useEffect(() => { if (!user) return; void getBlockedProfiles(user.id).then(setBlockedUsers).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not load blocked accounts.')) }, [user])

  const changeAvatar = async (file?: File) => {
    if (!file || !user) return
    setUploadingAvatar(true)
    try { await uploadAvatar(user.id, file); await refreshProfile(); setAvatarPreview(null); toast.success('Profile photo updated.') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update profile photo.') }
    finally { setUploadingAvatar(false) }
  }

  const unblock = async (blockedId: string) => {
    if (!user) return
    try { await unblockUser(user.id, blockedId); setBlockedUsers((old) => old.filter((person) => person.id !== blockedId)); toast.success('Account unblocked.') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not unblock account.') }
  }

  const save = async () => {
    if (!user || !profile) return
    if (!/^[a-zA-Z0-9_.]{3,24}$/.test(username)) { toast.error('Username must be 3–24 characters using letters, numbers, dots or underscores.'); return }
    setSaving(true)
    try { await updateProfile(user.id, { display_name: displayName.trim(), username: username.toLowerCase(), bio: bio.trim(), is_private: isPrivate }); await refreshProfile(); toast.success('Your profile has been updated.') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save profile.') }
    finally { setSaving(false) }
  }

  return <div className="content-page settings-page"><div className="page-heading-block"><span className="eyebrow"><UserRound size={13} /> MAKE IT YOURS</span><h1>Settings<span className="lime-dot">.</span></h1><p>Your account, your boundaries, your Loop.</p></div>
    {!configured && <div className="setup-card"><div className="setup-card-icon"><KeyRound size={21} /></div><div><span className="eyebrow">ONE-TIME SETUP</span><h2>Connect your Supabase project</h2><p>Copy <code>.env.example</code> to <code>.env.local</code>, add your project URL and publishable key, then run the SQL setup in the Supabase dashboard. See the included README for the exact steps.</p></div></div>}
    <div className="settings-grid"><section className="settings-card"><div className="settings-card-head"><div className="settings-card-icon"><UserRound size={18} /></div><div><h2>Profile details</h2><p>What people see when they find you.</p></div></div><div className="profile-photo-row"><div className="avatar profile-photo-avatar">{avatarPreview || profile?.avatar_url ? <img src={avatarPreview || profile?.avatar_url || ''} alt="Profile preview" /> : profile?.display_name.slice(0, 1)}</div><div><strong>Profile photo</strong><span>JPG, PNG or WebP · up to 5 MB</span></div><input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => void changeAvatar(event.target.files?.[0])} /><button className="outline-button" onClick={() => avatarInput.current?.click()} disabled={!configured || uploadingAvatar}><Camera size={14} /> {uploadingAvatar ? 'Uploading…' : 'Change photo'}</button></div><label className="field-label" htmlFor="display-name">DISPLAY NAME</label><input id="display-name" value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} /><label className="field-label" htmlFor="username">USERNAME</label><div className="username-input"><span>@</span><input id="username" value={username} maxLength={24} onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9_.]/g, ''))} /></div><label className="field-label" htmlFor="bio">BIO</label><textarea id="bio" rows={3} maxLength={160} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="A little about you…" /><div className="settings-char-count">{bio.length}/160</div><button className="primary-button save-settings" onClick={() => void save()} disabled={saving || !configured}><Save size={15} /> {saving ? 'Saving…' : 'Save changes'}</button></section>
      <div className="settings-side-column"><section className="settings-card"><div className="settings-card-head"><div className="settings-card-icon"><LockKeyhole size={18} /></div><div><h2>Privacy</h2><p>Choose who gets to see your loops.</p></div></div><div className="privacy-toggle-row"><div><strong>Private account</strong><p>Only approved followers can see your posts.</p></div><button className={`toggle-switch${isPrivate ? ' on' : ''}`} onClick={() => setIsPrivate((old) => !old)} aria-label="Toggle private account"><span /></button></div><div className="privacy-note"><ShieldCheck size={15} /> Accounts belonging to users under 18 are kept private automatically.</div></section>
      <section className="settings-card"><div className="settings-card-head"><div className="settings-card-icon"><ShieldCheck size={18} /></div><div><h2>Safety centre</h2><p>Tools to help keep your space comfortable.</p></div></div><div className="settings-link-row"><div><strong>Community guidelines</strong><span>What belongs on Loop.</span></div><ExternalLink size={15} /></div><div className="blocked-accounts-block"><div className="blocked-heading"><div><strong>Blocked accounts</strong><span>People you have chosen not to interact with.</span></div><span>{blockedUsers.length}</span></div>{blockedUsers.length ? blockedUsers.map((person) => <div className="blocked-person" key={person.id}><div className="avatar avatar-xs">{person.avatar_url ? <img src={person.avatar_url} alt="" /> : person.display_name.slice(0, 1)}</div><div><strong>{person.display_name}</strong><span>@{person.username}</span></div><button className="mini-action" onClick={() => void unblock(person.id)}>Unblock</button></div>) : <p className="blocked-empty">No accounts blocked.</p>}</div><div className="settings-link-row"><div><strong>Report a problem</strong><span>Tell the team when something is wrong.</span></div><CircleHelp size={15} /></div></section>
      <section className="settings-card account-card"><span className="eyebrow">ACCOUNT</span><p>{user?.email ?? 'Preview account'}</p>{admin && <button className="outline-button" onClick={() => navigate('/admin')}>Open admin dashboard <ExternalLink size={14} /></button>}<button className="danger-text-button" onClick={async () => { await signOut(); navigate('/login') }} disabled={!isSupabaseConfigured}>Sign out</button></section></div></div>
    <div className="settings-disclaimer">Loop is a community platform. Keep personal details private, use a strong password and report content that makes you uncomfortable.</div>
  </div>
}
