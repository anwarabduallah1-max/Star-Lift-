import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getAvatarSignedUrl } from '../components/AvatarUpload'
import { SQUAD_MAX_MEMBERS } from '../lib/config'
import type { Squad } from '../lib/types'
import { Crown, Award, Shield, Rocket } from 'lucide-react'

export default function SquadPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [squad, setSquad] = useState<Squad | null>(null)
  const [loading, setLoading] = useState(true)
  const [squadName, setSquadName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string | null>>({})

  const fetchSquad = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_squad')
      if (error) throw error
      setSquad(data as Squad | null)
    } catch (err) {
      console.error('Squad fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchSquad()
    const joinCode = searchParams.get('join')
    if (joinCode) setInviteCode(joinCode.toUpperCase())
  }, [user, navigate, fetchSquad, searchParams])

  useEffect(() => {
    if (!squad) return
    let cancelled = false
    const loadAvatars = async () => {
      const urls: Record<string, string | null> = {}
      for (const m of squad.members) {
        if (m.avatar_url) {
          const url = await getAvatarSignedUrl(m.avatar_url)
          if (!cancelled) urls[m.user_id] = url
        }
      }
      if (!cancelled) setAvatarUrls(urls)
    }
    loadAvatars()
    return () => { cancelled = true }
  }, [squad])

  const handleCreate = async () => {
    setBusy(true)
    try {
      const { error } = await supabase.rpc('create_squad', { p_name: squadName })
      setBusy(false)
      if (error) {
        showToast(error.message, 'error')
      } else {
        showToast('Squad created! Share your invite code.', 'success')
        setSquadName('')
        fetchSquad()
      }
    } catch (err) {
      console.error('Create squad error:', err)
      setBusy(false)
      showToast('Could not create squad.', 'error')
    }
  }

  const handleJoin = async () => {
    setBusy(true)
    try {
      const { error } = await supabase.rpc('join_squad', { p_invite_code: inviteCode })
      setBusy(false)
      if (error) {
        showToast(error.message, 'error')
      } else {
        showToast('Joined the squad!', 'success')
        setInviteCode('')
        fetchSquad()
      }
    } catch (err) {
      console.error('Join squad error:', err)
      setBusy(false)
      showToast('Could not join squad.', 'error')
    }
  }

  const handleLeave = async () => {
    if (!squad) return
    setBusy(true)
    try {
      const { error } = await supabase.rpc('leave_squad', { p_squad_id: squad.id })
      setBusy(false)
      if (error) {
        showToast(error.message, 'error')
      } else {
        showToast('Left the squad.', 'success')
        setSquad(null)
        fetchSquad()
      }
    } catch (err) {
      console.error('Leave squad error:', err)
      setBusy(false)
      showToast('Could not leave squad.', 'error')
    }
  }

  const handleShare = () => {
    if (!squad) return
    const link = `${window.location.origin}/squad?join=${squad.invite_code}`
    navigator.clipboard.writeText(link).then(() => {
      showToast('Squad invite link copied!', 'success')
    }).catch(() => {
      showToast('Could not copy link.', 'error')
    })
  }

  const memberCount = squad?.members.length ?? 0
  const totalDonated = squad?.members.reduce((sum, m) => sum + Number(m.total_donated), 0) ?? 0
  const isOwner = squad?.owner_id === user?.id

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 60px)', paddingTop: 40 }}>
        <div className="page-container">
          <div className="skeleton" style={{ height: 400, borderRadius: 16 }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', paddingBottom: 80, paddingTop: 40 }}>
      <div className="page-container" style={{ maxWidth: 640 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em' }}>Trio Squad</h1>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--text-secondary)' }}>
            Team up with 2 friends. Track your combined impact and compete for the top spot.
          </p>
        </div>

        {squad ? (
          <>
            <div style={{
              background: 'linear-gradient(145deg, rgba(255,200,1,0.08), var(--surface-raised))',
              border: '1px solid rgba(255,200,1,0.25)',
              borderRadius: 16, padding: 28, marginBottom: 24, textAlign: 'center',
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                {squad.name}
              </div>
              <div style={{ fontSize: 40, fontWeight: 900, color: 'var(--accent)', letterSpacing: '-0.02em' }}>
                ★ {totalDonated.toFixed(0)}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>
                Combined donations from {memberCount}/{SQUAD_MAX_MEMBERS} members
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button className="btn-primary" onClick={handleShare} style={{ padding: '10px 20px', fontSize: 14 }}>
                  Share Invite Link
                </button>
                <button className="btn-ghost" onClick={handleLeave} disabled={busy} style={{ padding: '10px 20px', fontSize: 14, color: 'var(--error)' }}>
                  {isOwner ? 'Disband' : 'Leave Squad'}
                </button>
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                Invite code: <span style={{ fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.05em' }}>{squad.invite_code}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {squad.members.map((m, i) => {
                const isTop = i === 0 && Number(m.total_donated) > 0
                return (
                  <div key={m.user_id} style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '16px 20px', borderRadius: 12,
                    background: 'var(--surface-raised)', border: '1px solid var(--border)',
                    ...(isTop ? {
                      borderColor: 'rgba(255,200,1,0.3)',
                      boxShadow: '0 0 16px rgba(255,200,1,0.08)',
                    } : {}),
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      ...(isTop ? {
                        background: 'linear-gradient(135deg, #f5c842, #f7d265)',
                        color: '#0d0f14',
                        boxShadow: '0 0 12px rgba(255,200,1,0.4)',
                      } : {
                        background: 'var(--surface)',
                        color: i === 1 ? 'var(--text-secondary)' : 'var(--text-muted)',
                        border: '1px solid var(--border)',
                      }),
                    }}>
                      {isTop ? <Crown size={22} fill="currentColor" /> : i === 1 ? <Award size={20} /> : <Shield size={20} />}
                    </div>

                    <div className="avatar" style={{ width: 36, height: 36, fontSize: 14, flexShrink: 0, overflow: 'hidden' }}>
                      {avatarUrls[m.user_id] ? (
                        <img src={avatarUrls[m.user_id]!} alt={m.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        (m.username?.[0] ?? 'U').toUpperCase()
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {m.username || 'Anonymous'}
                        </span>
                        {m.user_id === user?.id && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-muted)', borderRadius: 999, padding: '1px 7px' }}>You</span>
                        )}
                        {isTop && (
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#0d0f14', background: 'linear-gradient(135deg, #f5c842, #f7d265)', borderRadius: 999, padding: '1px 8px', letterSpacing: '0.04em' }}>
                            TOP
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginTop: 3 }}>
                        ★ {Number(m.total_donated).toFixed(0)} donated
                      </div>
                    </div>
                  </div>
                )
              })}

              {Array.from({ length: SQUAD_MAX_MEMBERS - memberCount }).map((_, i) => (
                <div key={`empty-${i}`} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px 20px', borderRadius: 12,
                  background: 'var(--surface)', border: '1px dashed var(--border)',
                  opacity: 0.6,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, color: 'var(--text-muted)', flexShrink: 0,
                    border: '1px dashed var(--border)',
                  }}>+</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Open slot</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Share your invite link to fill this spot</div>
                  </div>
                </div>
              ))}
            </div>

            {memberCount === SQUAD_MAX_MEMBERS && (() => {
              const lastMember = squad.members[squad.members.length - 1]
              if (lastMember?.user_id !== user?.id) return null
              return (
                <div style={{
                  marginTop: 20, padding: '14px 18px', borderRadius: 10,
                  background: 'rgba(255,200,1,0.06)', border: '1px solid rgba(255,200,1,0.2)',
                  textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--accent)',
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Boost your amount to rank higher! <Rocket size={16} /></span>
                </div>
              )
            })()}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800 }}>Create a Squad</h3>
              <input
                className="field-input"
                type="text"
                placeholder="Squad name (optional)"
                value={squadName}
                onChange={e => setSquadName(e.target.value)}
                style={{ width: '100%', marginBottom: 14 }}
              />
              <button className="btn-primary" onClick={handleCreate} disabled={busy} style={{ width: '100%', padding: 12, fontSize: 15 }}>
                {busy ? 'Creating...' : 'Create Squad'}
              </button>
            </div>

            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>— or —</div>

            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800 }}>Join a Squad</h3>
              <input
                className="field-input"
                type="text"
                placeholder="Enter invite code"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                style={{ width: '100%', marginBottom: 14, textTransform: 'uppercase' }}
              />
              <button className="btn-secondary" onClick={handleJoin} disabled={busy || !inviteCode.trim()} style={{ width: '100%', padding: 12, fontSize: 15 }}>
                {busy ? 'Joining...' : 'Join Squad'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
