// Platform fee percentage applied to every request's final target.
export const PLATFORM_FEE = 0.10

// Paid upgrade costs in Stars (1 Star = 1 USDT)
export const UPGRADE_COSTS = {
  bump: 1,
  verified: 2,
  gold: 6,
} as const

// Donor processing fee percentage (when donor opts to cover it)
export const DONOR_FEE_PERCENT = 0.05

// Wheel spin cost in Stars
export const WHEEL_COST = 1

// Squad max members
export const SQUAD_MAX_MEMBERS = 3
