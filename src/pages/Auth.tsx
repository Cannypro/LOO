import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Clapperboard, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'

function ageOn(dateOfBirth: string) {
  const birth = new Date(`${dateOfBirth}T00:00:00`)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export function AuthPage() {
  const { user, loading: authLoading, configured, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [accepted, setAccepted] = useState(false)

  if (configured && authLoading) return <div className="content-page"><div className="profile-skeleton" /></div>
  if (user && configured) return <Navigate to="/" replace />
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!configured) { toast.error('Connect Supabase first. See the setup guide in Settings.'); return }
    if (mode === 'signup') {
      if (!accepted) { toast.error('Please agree to the community rules and terms.'); return }
      if (!dateOfBirth || ageOn(dateOfBirth) < 13) { toast.error('Loop is for people aged 13 and above.'); return }
      if (ageOn(dateOfBirth) > 120) { toast.error('Please enter a valid date of birth.'); return }
      if (!/^[a-zA-Z0-9_.]{3,24}$/.test(username)) { toast.error('Username must be 3–24 characters using letters, numbers, dots or underscores.'); return }
      if (password.length < 8) { toast.error('Use a password with at least 8 characters.'); return }
    }
    setLoading(true)
    try {
      if (mode === 'login') { await signIn(email, password); toast.success('Welcome back to Loop.'); navigate('/') }
      else {
        const needsEmailConfirm = await signUp({ email, password, username, displayName: displayName || username, dateOfBirth })
        if (needsEmailConfirm) toast.success('Account created. Check your email to confirm your address before signing in.')
        else { toast.success('Your Loop account is ready.'); navigate('/') }
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  return <div className="auth-screen"><div className="auth-backdrop-orb orb-left" /><div className="auth-backdrop-orb orb-right" /><Link to="/" className="auth-back-link"><ArrowLeft size={16} /> Back to Loop</Link><div className="auth-shell"><section className="auth-brand-panel"><Link to="/" className="brand-lockup auth-brand"><span className="brand-mark"><Clapperboard size={21} /></span><span>loop<span className="brand-dot">.</span></span></Link><div className="auth-brand-art"><div className="auth-circles"><span /><span /><span /></div><div className="auth-brand-copy"><span className="eyebrow">A LITTLE WORLD OF YOUR OWN</span><h1>Life moves<br />fast. <em>Loop it.</em></h1><p>Ten seconds to share a feeling, a laugh, a tiny piece of your world.</p></div><div className="auth-brand-foot"><span>✳</span> MAKE A MOMENT. MAKE IT COUNT.</div></div></section><section className="auth-form-panel"><div className="auth-form-inner"><span className="eyebrow">{mode === 'signup' ? 'YOUR NEXT CHAPTER STARTS HERE' : 'GOOD TO HAVE YOU BACK'}</span><h2>{mode === 'signup' ? 'Join the loop.' : 'Welcome back.'}</h2><p className="auth-subtitle">{mode === 'signup' ? 'Create an account and find your people.' : 'Pick up right where you left off.'}</p>
    {!configured ? <div className="auth-setup-notice"><ShieldCheck size={20} /><strong>Connect your project first</strong><p>Authentication becomes active after you add your Supabase URL and publishable key to <code>.env.local</code> and run the database setup.</p><Link to="/settings">Open setup guide <ArrowRight size={14} /></Link></div> : <form className="auth-form" onSubmit={(event) => void submit(event)}>
      {mode === 'signup' && <><label className="field-label" htmlFor="auth-display">YOUR NAME</label><input id="auth-display" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} placeholder="How should we call you?" required /><label className="field-label" htmlFor="auth-username">USERNAME</label><div className="username-input"><span>@</span><input id="auth-username" value={username} onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9_.]/g, ''))} maxLength={24} placeholder="yourname" required /></div><label className="field-label" htmlFor="auth-dob">DATE OF BIRTH</label><input id="auth-dob" type="date" value={dateOfBirth} max={new Date(new Date().setFullYear(new Date().getFullYear() - 13)).toISOString().slice(0, 10)} onChange={(event) => setDateOfBirth(event.target.value)} required /><div className="auth-safety-note"><ShieldCheck size={15} /> Under-18 accounts are private by default, with extra privacy protections.</div></>}
      <label className="field-label" htmlFor="auth-email">EMAIL ADDRESS</label><input id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /><label className="field-label" htmlFor="auth-password">PASSWORD</label><div className="password-input"><input id="auth-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} minLength={8} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
      {mode === 'signup' && <label className="terms-check"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>I agree to the <Link to="/terms">Terms</Link>, <Link to="/privacy">Privacy Policy</Link> and <Link to="/community-guidelines">Community Guidelines</Link>. I will only post content I have permission to share.</span></label>}
      <button className="primary-button auth-submit" type="submit" disabled={loading}>{loading ? 'One moment…' : mode === 'signup' ? 'Create my account' : 'Sign in'} <ArrowRight size={16} /></button>
    </form>}
    <div className="auth-switch">{mode === 'signup' ? <>Already have an account? <button onClick={() => setMode('login')}>Sign in</button></> : <>New to Loop? <button onClick={() => setMode('signup')}>Create an account</button></>}</div><div className="auth-trust"><span><ShieldCheck size={14} /> Safety matters here</span><span><Sparkles size={14} /> Always just 10 seconds</span></div></div></section></div><p className="auth-legal">© 2026 LOOP. A PLACE FOR MOMENTS, NOT PERFECTION.</p></div>
}
