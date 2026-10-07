import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAvatarSignedUrl } from './AvatarUpload'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    getAvatarSignedUrl(profile?.avatar_url).then(url => { if (active) setAvatarUrl(url) })
    return () => { active = false }
  }, [profile?.avatar_url])

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const activePath = window.location.pathname

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      backdropFilter: 'blur(12px)',
    }}>
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, flexWrap: 'nowrap' }}>
        <div onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)' }}>★</span>
          <span className="nav-brand-text" style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>StarLift</span>
        </div>

        <div className="nav-actions">
          {user ? (
            <>
              <span className="stars-badge" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                ★ {profile?.stars_balance?.toFixed(0) ?? 0}
              </span>
              <button
                className="btn-ghost"
                onClick={() => navigate('/')}
                style={{ fontSize: 14, padding: '6px 12px', whiteSpace: 'nowrap', color: activePath === '/' ? 'var(--accent)' : undefined }}
              >
                Explore
              </button>
              <button
                className="btn-ghost"
                onClick={() => navigate('/dashboard')}
                style={{ fontSize: 14, padding: '6px 12px', whiteSpace: 'nowrap', color: activePath === '/dashboard' ? 'var(--accent)' : undefined }}
              >
                Dashboard
              </button>
              <button
                className="btn-ghost"
                onClick={() => navigate('/squad')}
                style={{ fontSize: 14, padding: '6px 12px', whiteSpace: 'nowrap', color: activePath === '/squad' ? 'var(--accent)' : undefined }}
              >
                Squad
              </button>
              <div ref={menuRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  aria-label="Open profile settings"
                  style={{
                    width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', padding: 0,
                    border: '1px solid rgba(255,200,1,0.35)', background: 'var(--accent-muted)',
                    color: 'var(--accent)', cursor: 'pointer', fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {avatarUrl ? <img src={avatarUrl} alt="Your profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (profile?.username?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()}
                </button>
                {menuOpen && (
                  <div
                    style={{
                      position: 'absolute', right: 0, top: 44,
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 10, boxShadow: 'var(--shadow-elevated)',
                      minWidth: 180, overflow: 'hidden', zIndex: 99,
                    }}
                  >
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {profile?.username ?? 'User'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{user.email}</div>
                    </div>
                    <button
                      onClick={() => { setMenuOpen(false); navigate('/profile') }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 14, color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-raised)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      Profile settings
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); navigate('/dashboard') }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 14, color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-raised)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      Dashboard
                    </button>
                    <hr className="divider" />
                    <button
                      onClick={async () => { setMenuOpen(false); await signOut(); navigate('/') }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 14, color: 'var(--error)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-raised)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button className="btn-ghost" onClick={() => navigate('/login')} style={{ fontSize: 14, whiteSpace: 'nowrap' }}>Sign In</button>
              <button className="btn-primary" onClick={() => navigate('/signup')} style={{ fontSize: 14, padding: '8px 18px', whiteSpace: 'nowrap' }}>
                Get Started
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
