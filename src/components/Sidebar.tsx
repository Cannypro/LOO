import { NavLink, useNavigate } from 'react-router-dom'
import { Compass, Home, Bookmark, Bell, Settings, Plus, ShieldCheck, LogOut, CircleUserRound, Clapperboard } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const navClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`

export function Sidebar({ onUpload }: { onUpload: () => void }) {
  const { profile, signOut, configured } = useAuth()
  const navigate = useNavigate()
  return (
    <aside className="sidebar">
      <NavLink to="/" className="brand-lockup" aria-label="Loop home">
        <span className="brand-mark"><Clapperboard size={21} strokeWidth={2.4} /></span>
        <span>loop<span className="brand-dot">.</span></span>
      </NavLink>
      <div className="sidebar-label">YOUR SPACE</div>
      <nav className="nav-stack">
        <NavLink to="/" end className={navClass}><Home size={19} /><span>Home</span><span className="nav-hint">01</span></NavLink>
        <NavLink to="/explore" className={navClass}><Compass size={19} /><span>Explore</span></NavLink>
        <NavLink to="/saved" className={navClass}><Bookmark size={19} /><span>Saved</span></NavLink>
        <NavLink to="/notifications" className={navClass}><Bell size={19} /><span>Activity</span></NavLink>
      </nav>
      <div className="sidebar-label secondary-label">CREATE</div>
      <button className="nav-link upload-link" onClick={onUpload}><span className="upload-plus"><Plus size={16} /></span><span>Post a loop</span></button>
      <div className="sidebar-spacer" />
      <div className="sidebar-promo">
        <div className="promo-glow" />
        <span className="promo-eyebrow">THE 10-SECOND CLUB</span>
        <strong>Make a moment.<br />Make it count.</strong>
        <span className="promo-small">Your next favourite creator is one loop away.</span>
      </div>
      <nav className="nav-stack bottom-nav-stack">
        <NavLink to={profile ? `/@${profile.username}` : '/login'} className={navClass}><CircleUserRound size={19} /><span>Your profile</span></NavLink>
        <NavLink to="/settings" className={navClass}><Settings size={19} /><span>Settings</span></NavLink>
        {configured && <button className="nav-link" onClick={async () => { await signOut(); navigate('/login') }}><LogOut size={18} /><span>Log out</span></button>}
        <NavLink to="/admin" className={navClass}><ShieldCheck size={18} /><span>Creator safety</span></NavLink>
      </nav>
      <div className="sidebar-foot"><span className="status-dot" /> Made for moments <span>© 2026</span></div>
    </aside>
  )
}

export function MobileNav({ onUpload }: { onUpload: () => void }) {
  return (
    <nav className="mobile-nav">
      <NavLink to="/" end className={navClass}><Home size={21} /><span>Home</span></NavLink>
      <NavLink to="/explore" className={navClass}><Compass size={21} /><span>Explore</span></NavLink>
      <button className="mobile-create" onClick={onUpload}><Plus size={23} /></button>
      <NavLink to="/notifications" className={navClass}><Bell size={21} /><span>Activity</span></NavLink>
      <NavLink to="/settings" className={navClass}><CircleUserRound size={21} /><span>You</span></NavLink>
    </nav>
  )
}
