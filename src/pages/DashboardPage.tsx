import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { PaymentOrder, Withdrawal, Request } from '../lib/types'
import WalletModal from '../components/WalletModal'
import WithdrawBalanceModal from '../components/WithdrawBalanceModal'
import RequestCard from '../components/RequestCard'
import DonateModal from '../components/DonateModal'

interface ReferralStats { referral_code: string; invited_count: number; earned_stars: number }

export default function DashboardPage() {
  const { user, profile, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [orders, setOrders] = useState<PaymentOrder[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [requests, setRequests] = useState<Request[]>([])
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null)
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [loadingReferral, setLoadingReferral] = useState(true)

  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)

  useEffect(() => { if (!user) navigate('/login') }, [user, navigate])

  const fetchOrders = useCallback(async () => {
    if (!user) return
    try {
      const { data } = await supabase.from('payment_orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5)
      if (data) setOrders(data as PaymentOrder[])
    } catch (err) { console.error('Fetch orders error:', err) }
    finally { setLoadingOrders(false) }
  }, [user])

  const fetchWithdrawals = useCallback(async () => {
    if (!user) return
    try {
      const { data } = await supabase.from('withdrawals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5)
      if (data) setWithdrawals(data as Withdrawal[])
    } catch (err) { console.error('Fetch withdrawals error:', err) }
  }, [user])

  const fetchRequests = useCallback(async () => {
    if (!user) return
    try {
      const { data } = await supabase.from('requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      if (data) setRequests(data as Request[])
    } catch (err) { console.error('Fetch my requests error:', err) }
    finally { setLoadingRequests(false) }
  }, [user])

  const fetchReferral = useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await supabase.rpc('get_referral_stats')
      if (!error && data?.[0]) setReferralStats(data[0] as ReferralStats)
    } catch (err) { console.error('Fetch referral stats error:', err) }
    finally { setLoadingReferral(false) }
  }, [user])

  useEffect(() => {
    fetchOrders(); fetchWithdrawals(); fetchRequests(); fetchReferral()
  }, [fetchOrders, fetchWithdrawals, fetchRequests, fetchReferral])

  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('dashboard-payment-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'payment_orders', filter: `user_id=eq.${user.id}` }, () => { fetchOrders(); refreshProfile() }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, fetchOrders, refreshProfile])

  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('dashboard-withdrawals').on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals', filter: `user_id=eq.${user.id}` }, () => { fetchWithdrawals(); refreshProfile() }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, fetchWithdrawals, refreshProfile])

  const handleWalletModalClose = async () => { setWalletModalOpen(false); await fetchOrders(); await refreshProfile() }
  const handleWithdrawModalClose = async () => { setWithdrawModalOpen(false); await fetchWithdrawals(); await refreshProfile() }

  const copyReferralLink = async () => {
    if (!referralStats) return
    const link = `${window.location.origin}/signup?ref=${referralStats.referral_code}`
    try { await navigator.clipboard.writeText(link); showToast('Referral link copied!', 'success') } catch { showToast('Could not copy the link.', 'error') }
  }

  if (!user) return null

  const balance = profile?.stars_balance ?? 0
  const pendingCount = orders.filter(o => o.status === 'pending').length
  const referralLink = referralStats ? `${window.location.origin}/signup?ref=${referralStats.referral_code}` : ''

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', paddingBottom: 80, paddingTop: 40 }}>
      <div className="page-container" style={{ maxWidth: 820 }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Account</div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em' }}>Dashboard</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>Manage your wallet, campaigns, and referrals in one place.</p>
        </div>

        {/* WALLET SECTION */}
        <div className="card" style={{ padding: 28, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Wallet</h2>
            <span style={{ fontSize: 32, fontWeight: 900, color: 'var(--accent)' }}>★ {balance.toFixed(0)}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <button className="btn-primary" onClick={() => setWalletModalOpen(true)} style={{ flex: 1, padding: '14px', fontSize: 15 }}>Buy Stars</button>
            <button
              className="btn-primary"
              onClick={() => setWithdrawModalOpen(true)}
              disabled={balance < 1}
              style={{
                flex: 1, padding: '14px', fontSize: 15,
                background: balance < 1 ? 'var(--surface-raised)' : 'rgba(62,207,142,0.9)',
                color: balance < 1 ? 'var(--text-muted)' : '#fff',
                cursor: balance < 1 ? 'not-allowed' : 'pointer', opacity: balance < 1 ? 0.6 : 1,
              }}
            >
              Withdraw
            </button>
          </div>

          {(loadingOrders ? false : orders.length > 0) && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Recent Orders</span>
                {pendingCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, color: 'var(--accent)', background: 'var(--accent-muted)' }}>{pendingCount} pending</span>}
              </div>
              {orders.map(o => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>★ {o.stars_amount} · ${o.usdt_amount}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{new Date(o.created_at).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {o.status === 'pending' && o.plisio_invoice_url && <a href={o.plisio_invoice_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>Pay ↗</a>}
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, color: o.status === 'confirmed' ? 'var(--success)' : o.status === 'failed' ? 'var(--error)' : 'var(--accent)', background: o.status === 'confirmed' ? 'rgba(62,207,142,0.1)' : o.status === 'failed' ? 'rgba(240,96,96,0.1)' : 'var(--accent-muted)' }}>{o.status === 'pending' ? 'Pending' : o.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {withdrawals.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>Recent Payouts</div>
              {withdrawals.map(w => (
                <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>★ {w.stars_amount} → {w.usdt_amount} USDT</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{new Date(w.created_at).toLocaleDateString()}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, color: w.status === 'completed' ? 'var(--success)' : w.status === 'failed' ? 'var(--error)' : 'var(--accent)', background: w.status === 'completed' ? 'rgba(62,207,142,0.1)' : w.status === 'failed' ? 'rgba(240,96,96,0.1)' : 'var(--accent-muted)' }}>{w.status === 'processing' ? 'Processing' : w.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MY REQUESTS SECTION */}
        <div className="card" style={{ padding: 28, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>My Requests</h2>
            <button className="btn-primary" onClick={() => navigate('/create')} style={{ padding: '10px 20px', fontSize: 13 }}>+ New Request</button>
          </div>
          {loadingRequests ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '20px 0' }}>Loading your campaigns...</div>
          ) : requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>★</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No requests yet</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Create your first funding request!</div>
              <button className="btn-primary" onClick={() => navigate('/create')} style={{ fontSize: 13, padding: '10px 24px' }}>Create a Request</button>
            </div>
          ) : (
            <div className="grid-cards">
              {requests.map(r => <RequestCard key={r.id} request={r} onClick={() => setSelectedRequest(r)} />)}
            </div>
          )}
        </div>

        {/* REFERRAL SECTION */}
        <div className="card" style={{ padding: 28, borderColor: 'rgba(255,200,1,0.28)', background: 'linear-gradient(145deg, rgba(255,200,1,0.06), var(--surface) 55%)' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 800 }}>Referrals</h2>
          {loadingReferral ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading referral info...</div>
          ) : referralStats ? (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Your personal invite link</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                <input className="field-input" readOnly value={referralLink} style={{ flex: 1, minWidth: 200 }} />
                <button className="btn-primary" onClick={copyReferralLink}>Copy Link</button>
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Friends invited</div>
                  <div style={{ marginTop: 4, color: 'var(--text-primary)', fontSize: 26, fontWeight: 900 }}>{referralStats.invited_count}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Stars earned</div>
                  <div style={{ marginTop: 4, color: 'var(--accent)', fontSize: 26, fontWeight: 900 }}>★ {Number(referralStats.earned_stars).toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Referral code</div>
                  <div style={{ marginTop: 4, color: 'var(--accent)', fontSize: 18, fontWeight: 900, letterSpacing: '0.08em' }}>{referralStats.referral_code}</div>
                </div>
              </div>
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Commission is credited automatically when a referred user purchases a paid upgrade. You never need to enter a friend's user ID.
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Could not load referral stats.</div>
          )}
        </div>
      </div>

      {walletModalOpen && <WalletModal onClose={handleWalletModalClose} />}
      {withdrawModalOpen && <WithdrawBalanceModal balance={balance} onClose={handleWithdrawModalClose} onWithdrawn={handleWithdrawModalClose} />}
      {selectedRequest && <DonateModal request={selectedRequest} onClose={() => setSelectedRequest(null)} onDonated={() => {}} />}
    </div>
  )
}
