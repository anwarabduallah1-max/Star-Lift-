import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Request } from '../lib/types'
import RequestCard from '../components/RequestCard'
import DonateModal from '../components/DonateModal'
import UpgradeModal from '../components/UpgradeModal'
import { UPGRADE_COSTS } from '../lib/config'
import { BadgeCheck, ArrowUp, Zap } from 'lucide-react'

export default function MyRequestsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Request | null>(null)
  const [upgradeTarget, setUpgradeTarget] = useState<Request | null>(null)

  const fetchRequests = async () => {
    if (!user) return
    try {
      const { data } = await supabase
        .from('requests')
        .select('id, user_id, title, description, image_url, product_url, base_target, final_target, current_stars, is_unlimited, is_verified, is_gold, bumped_at, status, created_at, updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setRequests((data ?? []) as Request[])
    } catch (err) {
      console.error('Fetch my requests error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchRequests()
  }, [user])

  const activeBadges = (r: Request) => {
    const badges: { label: string; color: string; bg: string }[] = []
    if (r.is_gold) badges.push({ label: '★ Gold', color: '#0d0f14', bg: 'linear-gradient(135deg, #FFC801, #FFD633)' })
    if (r.is_verified) badges.push({ label: '✓ Verified', color: 'var(--accent)', bg: 'var(--accent-muted)' })
    if (r.bumped_at) badges.push({ label: '⬆ Bumped', color: 'var(--accent)', bg: 'var(--accent-muted)' })
    return badges
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', paddingBottom: 80, paddingTop: 40 }}>
      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em' }}>My Requests</h1>
            <p style={{ margin: 0, fontSize: 15, color: 'var(--text-secondary)' }}>Manage your funding campaigns</p>
          </div>
          <button className="btn-primary" onClick={() => navigate('/create')} style={{ padding: '12px 24px', fontSize: 14 }}>+ New Request</button>
        </div>

        {loading ? (
          <div className="grid-cards">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 340, borderRadius: 16 }} />)}
          </div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>★</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No requests yet</div>
            <div style={{ fontSize: 14, marginBottom: 24 }}>Create your first funding request!</div>
            <button className="btn-primary" onClick={() => navigate('/create')}>Create a Request</button>
          </div>
        ) : (
          <div className="grid-cards">
            {requests.map(r => {
              const badges = activeBadges(r)
              const allUpgrades = r.is_gold
              return (
                <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <RequestCard request={r} onClick={() => setSelected(r)} />
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderTop: 'none',
                    borderRadius: '0 0 14px 14px',
                  }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {badges.length > 0 ? (
                        badges.map((b, i) => (
                          <span key={i} style={{
                            fontSize: 10, fontWeight: 700,
                            color: b.color,
                            background: b.bg,
                            borderRadius: 999, padding: '2px 8px',
                            letterSpacing: '0.04em', textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                          }}>{b.label}</span>
                        ))
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No upgrades</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setUpgradeTarget(r) }}
                      disabled={allUpgrades}
                      style={{
                        background: allUpgrades ? 'var(--surface-raised)' : 'var(--accent)',
                        color: allUpgrades ? 'var(--text-muted)' : '#0d0f14',
                        border: 'none', borderRadius: 8,
                        padding: '5px 12px', fontSize: 11, fontWeight: 700,
                        cursor: allUpgrades ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4,
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s ease',
                        ...(allUpgrades ? {} : { boxShadow: '0 2px 8px rgba(255,200,1,0.25)' }),
                      }}
                      onMouseEnter={e => { if (!allUpgrades) { e.currentTarget.style.transform = 'scale(1.03)' } }}
                      onMouseLeave={e => { if (!allUpgrades) { e.currentTarget.style.transform = 'scale(1)' } }}
                    >
                      {allUpgrades ? 'Maxed' : <><Zap size={12} /> Boost</>}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {selected && <DonateModal request={selected} onClose={() => setSelected(null)} onDonated={fetchRequests} />}
      {upgradeTarget && (
        <UpgradeModal
          request={upgradeTarget}
          onClose={() => setUpgradeTarget(null)}
          onUpgraded={fetchRequests}
        />
      )}
    </div>
  )
}
