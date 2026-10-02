import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Request } from '../lib/types'
import RequestCard from '../components/RequestCard'
import DonateModal from '../components/DonateModal'
import UpgradeModal from '../components/UpgradeModal'

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
      const { data } = await supabase.from('requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
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
            {requests.map(r => (
              <div key={r.id} style={{ position: 'relative' }}>
                <RequestCard request={r} onClick={() => setSelected(r)} />
                <button
                  onClick={(e) => { e.stopPropagation(); setUpgradeTarget(r) }}
                  style={{
                    position: 'absolute', top: 10, left: 10,
                    background: 'var(--accent)', color: '#0d0f14',
                    border: 'none', borderRadius: 8,
                    padding: '5px 12px', fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', zIndex: 5,
                    display: 'flex', alignItems: 'center', gap: 4,
                    boxShadow: '0 2px 8px rgba(245,200,66,0.3)',
                  }}
                >
                  ⚡ Boost
                </button>
              </div>
            ))}
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
