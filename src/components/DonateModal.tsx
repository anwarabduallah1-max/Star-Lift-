import { useState } from 'react'
import type { Request } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { DONOR_FEE_PERCENT } from '../lib/config'
import { X } from 'lucide-react'
import ShareStoryModal from './ShareStoryModal'

interface Props {
  request: Request
  onClose: () => void
  onDonated: () => void
}

const PRESET_AMOUNTS = [5, 10, 25, 50]

export default function DonateModal({ request, onClose, onDonated }: Props) {
  const { user, profile, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const [amount, setAmount] = useState(5)
  const [loading, setLoading] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [coverFee, setCoverFee] = useState(false)

  const balance = profile?.stars_balance ?? 0
  const feeAmount = coverFee ? Math.round(amount * DONOR_FEE_PERCENT * 100) / 100 : 0
  const totalCharge = amount + feeAmount
  const insufficient = totalCharge > balance

  const handleDonate = async () => {
    if (!user) return
    if (amount <= 0) { showToast('Enter a valid amount', 'error'); return }
    if (insufficient) { showToast('Insufficient Stars balance. Top up your wallet first.', 'error'); return }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('donate_stars', {
        p_request_id: request.id,
        p_amount: amount,
        p_cover_fee: coverFee,
      })
      setLoading(false)

      if (error) {
        showToast(error.message, 'error')
      } else {
        showToast(`Donated ★ ${amount} to ${request.title}!`, 'success')
        await refreshProfile()
        onDonated()
        setShareOpen(true)
      }
    } catch (err) {
      console.error('Donate error:', err)
      setLoading(false)
      showToast('Donation failed. Please try again.', 'error')
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 420 }}>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Donate Stars</h2>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>{request.title}</p>
            </div>
            <button className="btn-ghost" onClick={onClose} style={{ padding: '4px 10px' }}><X size={18} /></button>
          </div>

          {request.image_url && (
            <img
              src={request.image_url}
              alt={request.title}
              loading="lazy"
              style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 10, marginBottom: 16 }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Your balance: ★ {balance.toFixed(0)}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {PRESET_AMOUNTS.map(a => (
                <button
                  key={a}
                  className={`chip ${amount === a ? 'active' : ''}`}
                  onClick={() => setAmount(a)}
                  style={{ minWidth: 56 }}
                >
                  ★ {a}
                </button>
              ))}
            </div>
            <input
              className="field-input"
              type="number"
              value={amount}
              onChange={e => setAmount(Math.max(0, parseFloat(e.target.value) || 0))}
              min={1}
              placeholder="Custom amount"
            />
          </div>

          {/* Cover processing fee toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', background: 'var(--surface-raised)',
            borderRadius: 10, border: '1px solid var(--border)', marginBottom: 14,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Cover processing fee</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Add ★ {feeAmount.toFixed(2)} (5%) so the campaign gets the full amount
              </div>
            </div>
            <button
              onClick={() => setCoverFee(!coverFee)}
              role="switch"
              aria-checked={coverFee}
              aria-label="Cover processing fee"
              style={{
                position: 'relative',
                width: 44, height: 24, borderRadius: 999,
                background: coverFee ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
                border: 'none', cursor: 'pointer',
                transition: 'background 0.2s ease',
                flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute',
                top: 3, left: coverFee ? 23 : 3,
                width: 18, height: 18, borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </button>
          </div>

          {/* Cost summary */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '10px 14px', marginBottom: 14,
            fontSize: 13, color: 'var(--text-muted)',
          }}>
            <span>Donation</span>
            <span>★ {amount.toFixed(2)}</span>
          </div>
          {coverFee && (
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '0 14px 10px', fontSize: 12, color: 'var(--text-muted)',
            }}>
              <span>Processing fee</span>
              <span>+ ★ {feeAmount.toFixed(2)}</span>
            </div>
          )}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '10px 14px', marginBottom: 14,
            background: 'var(--accent-muted)', borderRadius: 8,
            border: '1px solid rgba(255,200,1,0.2)',
            fontSize: 14, fontWeight: 700, color: 'var(--accent)',
          }}>
            <span>Total</span>
            <span>★ {totalCharge.toFixed(2)}</span>
          </div>

          {insufficient && (
            <div style={{ padding: '10px 14px', background: 'rgba(240,96,96,0.08)', border: '1px solid rgba(240,96,96,0.3)', borderRadius: 8, marginBottom: 14, fontSize: 13, color: 'var(--error)' }}>
              You need ★ {totalCharge.toFixed(2)} but have ★ {balance.toFixed(0)}. Top up your wallet first.
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handleDonate}
            disabled={loading || insufficient || amount <= 0}
            style={{ width: '100%', padding: '14px', fontSize: 15 }}
          >
            {loading ? 'Processing...' : `Donate ★ ${totalCharge.toFixed(2)}`}
          </button>
        </div>
      </div>
      {shareOpen && <ShareStoryModal request={request} referralCode={profile?.referral_code} onClose={() => { setShareOpen(false); onClose() }} />}
    </div>
  )
}
