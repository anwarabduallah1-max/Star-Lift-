import { useState } from 'react'
import type { Request } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { UPGRADE_COSTS } from '../lib/config'
import { X, ArrowUp, BadgeCheck, Star } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  request: Request
  onClose: () => void
  onUpgraded: () => void
}

type UpgradeType = 'bump' | 'verified' | 'gold'

interface UpgradeOption {
  type: UpgradeType
  name: string
  cost: number
  description: string
  icon: ReactNode
}

const OPTIONS: UpgradeOption[] = [
  { type: 'bump', name: 'Bump to Top', cost: UPGRADE_COSTS.bump, description: 'Move your request to the top of the Explore feed.', icon: <ArrowUp size={20} /> },
  { type: 'verified', name: 'Verified Badge', cost: UPGRADE_COSTS.verified, description: 'Add a verified badge to your request card.', icon: <BadgeCheck size={20} /> },
  { type: 'gold', name: 'Gold Wish Bundle', cost: UPGRADE_COSTS.gold, description: 'Premium gold card styling, verified badge, and bump to top.', icon: <Star size={20} fill="currentColor" /> },
]

export default function UpgradeModal({ request, onClose, onUpgraded }: Props) {
  const { profile, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const [loading, setLoading] = useState<UpgradeType | null>(null)

  const balance = profile?.stars_balance ?? 0

  const isAlreadyVerified = request.is_verified
  const isAlreadyGold = request.is_gold

  const handleUpgrade = async (type: UpgradeType) => {
    const cost = UPGRADE_COSTS[type]
    if (balance < cost) {
      showToast(`Insufficient Stars. You need ★ ${cost} for this upgrade.`, 'error')
      return
    }

    setLoading(type)
    try {
      const { error } = await supabase.rpc('purchase_upgrade', {
        p_request_id: request.id,
        p_upgrade_type: type,
      })
      setLoading(null)

      if (error) {
        showToast(error.message, 'error')
      } else {
        const opt = OPTIONS.find(o => o.type === type)
        showToast(`${opt?.name} applied! ★ ${cost} deducted.`, 'success')
        await refreshProfile()
        onUpgraded()
        onClose()
      }
    } catch (err) {
      console.error('Upgrade error:', err)
      setLoading(null)
      showToast('Upgrade failed. Please try again.', 'error')
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 440 }}>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Boost Your Request</h2>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>{request.title}</p>
            </div>
            <button className="btn-ghost" onClick={onClose} style={{ padding: '4px 10px' }}><X size={18} /></button>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Your balance: <span style={{ fontWeight: 700, color: 'var(--accent)' }}>★ {balance.toFixed(0)}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {OPTIONS.map(opt => {
              const isOwned = (opt.type === 'verified' && isAlreadyVerified) || (opt.type === 'gold' && isAlreadyGold)
              const canAfford = balance >= opt.cost
              const isLoading = loading === opt.type

              return (
                <div key={opt.type} style={{
                  padding: '16px',
                  background: opt.type === 'gold' ? 'linear-gradient(145deg, rgba(255,200,1,0.08), var(--surface-raised))' : 'var(--surface-raised)',
                  border: opt.type === 'gold' ? '1px solid rgba(255,200,1,0.25)' : '1px solid var(--border)',
                  borderRadius: 12,
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, flexShrink: 0,
                    background: opt.type === 'gold' ? 'linear-gradient(135deg, #FFC801, #FFD633)' : 'var(--accent-muted)',
                    color: opt.type === 'gold' ? '#0d0f14' : 'var(--accent)',
                  }}>{opt.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{opt.name}</span>
                      <span style={{
                        fontSize: 12, fontWeight: 800, color: 'var(--accent)',
                        background: 'var(--accent-muted)', borderRadius: 999, padding: '1px 8px',
                      }}>★ {opt.cost}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                      {opt.description}
                    </div>
                  </div>
                  {isOwned ? (
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: 'var(--success)',
                      padding: '6px 12px', borderRadius: 8,
                      background: 'rgba(62,207,142,0.1)', border: '1px solid rgba(62,207,142,0.2)',
                      whiteSpace: 'nowrap',
                    }}>Active</span>
                  ) : (
                    <button
                      className="btn-primary"
                      onClick={() => handleUpgrade(opt.type)}
                      disabled={loading !== null || !canAfford}
                      style={{ padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      {isLoading ? '...' : 'Buy'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            Upgrades are paid from your Stars balance. 1 Star = 1 USDT.
          </div>
        </div>
      </div>
    </div>
  )
}
