import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { WHEEL_COST } from '../lib/config'
import type { WheelCampaign } from '../lib/types'

interface Props {
  onClose: () => void
  onSpun: () => void
}

const SEGMENT_COLORS = ['#f5c842', '#3ecf8e', '#5b8def', '#f5c842', '#3ecf8e', '#5b8def']

export default function SpinWheelModal({ onClose, onSpun }: Props) {
  const { profile, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const [phase, setPhase] = useState<'pay' | 'fetching' | 'spinning' | 'result'>('pay')
  const [campaigns, setCampaigns] = useState<WheelCampaign[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [winningCampaign, setWinningCampaign] = useState<WheelCampaign | null>(null)
  const [busy, setBusy] = useState(false)

  const balance = profile?.stars_balance ?? 0
  const canAfford = balance >= WHEEL_COST

  const handlePay = async () => {
    if (!canAfford) {
      showToast(`You need at least ${WHEEL_COST} Star to spin the wheel.`, 'error')
      return
    }
    setBusy(true)
    setPhase('fetching')
    try {
      const { data, error } = await supabase.rpc('spin_wheel')
      setBusy(false)
      if (error) {
        showToast(error.message, 'error')
        setPhase('pay')
        return
      }

      const result = data as { selected_request_id: string; candidates: string[] }
      const { data: reqData } = await supabase
        .from('requests')
        .select('id, title, image_url, current_stars')
        .in('id', result.candidates)

      const sorted = (reqData ?? []).sort(
        (a, b) => result.candidates.indexOf(a.id) - result.candidates.indexOf(b.id)
      ) as WheelCampaign[]

      const selectedIdx = result.candidates.indexOf(result.selected_request_id)
      setCampaigns(sorted)
      setSelectedIndex(selectedIdx >= 0 ? selectedIdx : 0)
      await refreshProfile()

      const segments = sorted.length
      const segmentAngle = 360 / segments
      const targetRotation = 360 * 5 + (360 - (selectedIdx * segmentAngle + segmentAngle / 2))
      setRotation(targetRotation)
      setPhase('spinning')
    } catch (err) {
      console.error('Wheel error:', err)
      setBusy(false)
      showToast('Something went wrong. Please try again.', 'error')
      setPhase('pay')
    }
  }

  useEffect(() => {
    if (phase === 'spinning' && campaigns.length > 0) {
      const timer = setTimeout(() => {
        setWinningCampaign(campaigns[selectedIndex])
        setPhase('result')
        onSpun()
      }, 4200)
      return () => clearTimeout(timer)
    }
  }, [phase, campaigns, selectedIndex, onSpun])

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget && phase !== 'spinning') onClose() }}>
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Fair Random Wheel</h2>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>
                {phase === 'pay' && `Pay ${WHEEL_COST} Star to spin and donate to a random campaign`}
                {phase === 'fetching' && 'Selecting campaigns...'}
                {phase === 'spinning' && 'Spinning...'}
                {phase === 'result' && 'You got a result!'}
              </p>
            </div>
            {phase !== 'spinning' && (
              <button className="btn-ghost" onClick={onClose} style={{ padding: '4px 10px', fontSize: 18 }}>✕</button>
            )}
          </div>

          {phase === 'pay' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 120, height: 120, borderRadius: '50%', margin: '0 auto 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 48, background: 'var(--accent-muted)',
                border: '2px solid rgba(245,200,66,0.3)',
              }}>🎡</div>
              <div style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                Spin the wheel for <span style={{ fontWeight: 800, color: 'var(--accent)' }}>★ {WHEEL_COST}</span> and your donation lands on a random campaign.
                We prioritize campaigns with $0 raised first to give them visibility.
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                Your balance: <span style={{ fontWeight: 700, color: 'var(--accent)' }}>★ {balance.toFixed(0)}</span>
              </div>
              <button
                className="btn-primary"
                onClick={handlePay}
                disabled={busy || !canAfford}
                style={{ width: '100%', padding: 14, fontSize: 16 }}
              >
                {busy ? 'Processing...' : `Pay ★ ${WHEEL_COST} & Spin`}
              </button>
              {!canAfford && (
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--error)' }}>
                  Insufficient Stars. Top up your wallet first.
                </div>
              )}
            </div>
          )}

          {phase === 'fetching' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 16, animation: 'wheel-spin 1.2s linear infinite' }}>🎡</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Finding 6 campaigns that need your help...</div>
              <style>{`@keyframes wheel-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {(phase === 'spinning') && campaigns.length > 0 && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ position: 'relative', width: 280, height: 280, margin: '0 auto' }}>
                <div style={{
                  position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
                  width: 0, height: 0, zIndex: 10,
                  borderLeft: '12px solid transparent',
                  borderRight: '12px solid transparent',
                  borderTop: '20px solid var(--accent)',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                }} />
                <div
                  style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    transition: 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)',
                    transform: `rotate(${rotation}deg)`,
                    overflow: 'hidden',
                    border: '4px solid var(--accent)',
                    boxShadow: '0 0 24px rgba(245,200,66,0.2)',
                  }}
                >
                  <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
                    {campaigns.map((c, i) => {
                      const segments = campaigns.length
                      const angle = 360 / segments
                      const startAngle = i * angle - 90
                      const endAngle = (i + 1) * angle - 90
                      const startRad = (startAngle * Math.PI) / 180
                      const endRad = (endAngle * Math.PI) / 180
                      const x1 = 100 + 100 * Math.cos(startRad)
                      const y1 = 100 + 100 * Math.sin(startRad)
                      const x2 = 100 + 100 * Math.cos(endRad)
                      const y2 = 100 + 100 * Math.sin(endRad)
                      const largeArc = angle > 180 ? 1 : 0
                      const midAngle = (startAngle + endAngle) / 2
                      const midRad = (midAngle * Math.PI) / 180
                      const textX = 100 + 55 * Math.cos(midRad)
                      const textY = 100 + 55 * Math.sin(midRad)
                      const title = c.title.length > 18 ? c.title.slice(0, 16) + '...' : c.title
                      return (
                        <g key={c.id}>
                          <path
                            d={`M 100 100 L ${x1} ${y1} A 100 100 0 ${largeArc} 1 ${x2} ${y2} Z`}
                            fill={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
                            stroke="rgba(13,15,20,0.15)"
                            strokeWidth="1"
                          />
                          <text
                            x={textX} y={textY}
                            fill="#0d0f14"
                            fontSize="7"
                            fontWeight="700"
                            textAnchor="middle"
                            transform={`rotate(${midAngle + 90}, ${textX}, ${textY})`}
                          >
                            {title}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                </div>
              </div>
              <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>Spinning the wheel...</div>
            </div>
          )}

          {phase === 'result' && winningCampaign && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                Your ★ {WHEEL_COST} landed on...
              </h3>
              {winningCampaign.image_url && (
                <img
                  src={winningCampaign.image_url}
                  alt={winningCampaign.title}
                  loading="lazy"
                  style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 10, marginBottom: 14 }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', marginBottom: 8, lineHeight: 1.3 }}>
                {winningCampaign.title}!
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
                ★ {WHEEL_COST} has been donated to this campaign. Thank you for your generosity!
              </div>
              <button className="btn-primary" onClick={onClose} style={{ width: '100%', padding: 14, fontSize: 15 }}>
                Awesome!
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
