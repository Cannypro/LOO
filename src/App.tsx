import { useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, Link } from 'react-router-dom'
import { Bell, Search, Plus, ArrowUpRight, Clapperboard } from 'lucide-react'
import { Sidebar, MobileNav } from './components/Sidebar'
import { UploadModal } from './components/UploadModal'
import { useAuth } from './contexts/AuthContext'
import { FeedPage } from './pages/Feed'
import { ExplorePage } from './pages/Explore'
import { ProfilePage } from './pages/Profile'
import { SavedPage } from './pages/Saved'
import { NotificationsPage } from './pages/Notifications'
import { SettingsPage } from './pages/Settings'
import { AdminPage } from './pages/Admin'
import { AuthPage } from './pages/Auth'
import { LegalPage } from './pages/Legal'

function AppLayout({ onUpload }: { onUpload: () => void }) {
  const { profile, user, configured, loading } = useAuth()
  const location = useLocation()
  const path = location.pathname
  const routeTitle = path === '/' ? 'Your feed' : path === '/explore' ? 'Explore' : path === '/saved' ? 'Saved loops' : path === '/notifications' ? 'Activity' : path === '/settings' ? 'Settings' : path === '/admin' ? 'Safety centre' : path.startsWith('/@') ? 'Creator profile' : 'Loop'
  if (configured && loading) return <div className="content-page"><div className="profile-skeleton" /></div>
  if (configured && !user) return <Navigate to="/login" replace state={{ from: path }} />
  if (configured && profile?.is_suspended) return <div className="content-page"><div className="admin-locked"><h2>Account temporarily unavailable.</h2><p>Your account has been suspended by the moderation team. Contact the platform support address if you believe this is a mistake.</p></div></div>
  return (
    <div className="app-frame">
      <Sidebar onUpload={onUpload} />
      <div className="app-main-column">
        <header className="topbar">
          <div className="mobile-brand"><Link to="/" className="brand-lockup"><span className="brand-mark"><Clapperboard size={18} /></span><span>loop<span className="brand-dot">.</span></span></Link></div>
          <div className="topbar-context"><span className="eyebrow">YOUR WORLD, IN TEN SECONDS</span><span className="topbar-title">{routeTitle}</span></div>
          <div className="topbar-actions"><Link to="/explore" className="topbar-icon" aria-label="Search"><Search size={19} /></Link><Link to="/notifications" className="topbar-icon notification-top" aria-label="Activity"><Bell size={19} /></Link><button className="topbar-create" onClick={onUpload}><Plus size={16} /> <span>Create loop</span></button><Link to={profile ? `/@${profile.username}` : '/login'} className="topbar-avatar" aria-label="Your profile">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : profile?.display_name?.slice(0, 1) ?? 'Y'}</Link></div>
        </header>
        {!configured && <div className="demo-topline"><span className="demo-pulse" /> PREVIEW MODE <span>— connect your own Supabase project to activate sign-in, publishing and real social data.</span><Link to="/settings">Setup <ArrowUpRight size={12} /></Link></div>}
        <div className="route-content"><Outlet /></div>
      </div>
      <MobileNav onUpload={onUpload} />
      <div className="mobile-create-spacer" />
    </div>
  )
}

export default function App() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const location = useLocation()
  const { user } = useAuth()

  useEffect(() => {
    const open = () => setUploadOpen(true)
    window.addEventListener('loop:upload', open)
    return () => window.removeEventListener('loop:upload', open)
  }, [])

  useEffect(() => { setUploadOpen(false) }, [location.pathname])

  return <>
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/terms" element={<LegalPage kind="terms" />} />
      <Route path="/privacy" element={<LegalPage kind="privacy" />} />
      <Route path="/community-guidelines" element={<LegalPage kind="community" />} />
      <Route element={<AppLayout onUpload={() => setUploadOpen(true)} />}>
        <Route index element={<FeedPage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="saved" element={<SavedPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="@:username" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
      </Route>
    </Routes>
    <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onPublished={() => window.dispatchEvent(new Event('loop:refresh-feed'))} />
  </>
}
