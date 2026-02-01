import { FilingStatus } from 'ustaxes/core/data'
import { linear, Piecewise } from 'ustaxes/core/util'

export const CURRENT_YEAR = 2025

interface TaggedAmount {
  name: string
  amount: number
}

interface Brackets {
  brackets: number[]
}

interface Deductions {
  deductions: TaggedAmount[]
  exemptions: TaggedAmount[]
}

interface Rates {
  rates: number[]
}

interface FederalBrackets {
  ordinary: Rates & { status: { [key in FilingStatus]: Brackets & Deductions } }
  longTermCapGains: Rates & { status: { [key in FilingStatus]: Brackets } }
}

// =============================================================================
// OBBBA (One Big Beautiful Bill Act) 2025 Tax Parameters
// Source: docs/obbba/form-1040/TAX_BRACKETS.md
// =============================================================================

// Tax brackets under OBBBA - rates remain 10/12/22/24/32/35/37
// but thresholds are adjusted (Senate Finance Version for 2025)
// Source: docs/obbba/form-1040/STANDARD_DEDUCTION.md (Senate Finance Version)
const federalBrackets: FederalBrackets = {
  ordinary: {
    rates: [10, 12, 22, 24, 32, 35, 37],
    status: {
      [FilingStatus.S]: {
        // Single filer brackets under OBBBA 2025 (Senate Finance Version)
        // Source: IRS Rev Proc 2024-40 with OBBBA adjustments
        brackets: [11925, 48475, 103350, 197300, 250525, 626350],
        deductions: [
          {
            name: 'Standard Deduction (Single)',
            amount: 15750 // OBBBA Senate 2025: $15,750
          },
          {
            name: 'Standard Deduction (Single) with 1 age or blindness allowance',
            amount: 17750 // $15,750 + $2,000
          },
          {
            name: 'Standard Deduction (Single) with 2 age or blindness allowances',
            amount: 19750 // $15,750 + $4,000
          }
        ],
        exemptions: [
          {
            name: 'Standard Exemption (Single)',
            amount: 0
          }
        ]
      },
      [FilingStatus.MFJ]: {
        // MFJ brackets under OBBBA 2025 (Senate Finance Version)
        brackets: [23850, 96950, 206700, 394600, 501050, 751600],
        deductions: [
          {
            name: 'Standard Deduction (Married)',
            amount: 31500 // OBBBA Senate 2025: $31,500
          },
          {
            name: 'Standard Deduction (Married) with 1 age or blindness allowance',
            amount: 33100 // $31,500 + $1,600
          },
          {
            name: 'Standard Deduction (Married) with 2 age or blindness allowances',
            amount: 34700 // $31,500 + $3,200
          },
          {
            name: 'Standard Deduction (Married) with 3 age or blindness allowances',
            amount: 36300 // $31,500 + $4,800
          },
          {
            name: 'Standard Deduction (Married) with 4 age or blindness allowances',
            amount: 37900 // $31,500 + $6,400
          }
        ],
        exemptions: [
          {
            name: 'Standard Exemption (Single)',
            amount: 0
          }
        ]
      },
      [FilingStatus.W]: {
        brackets: [23850, 96950, 206700, 394600, 501050, 751600],
        deductions: [
          {
            name: 'Standard Deduction (Widowed)',
            amount: 31500 // Same as MFJ
          },
          {
            name: 'Standard Deduction (Widowed) with 1 age or blindness allowance',
            amount: 33100
          },
          {
            name: 'Standard Deduction (Widowed) with 2 age or blindness allowances',
            amount: 34700
          }
        ],
        exemptions: [
          {
            name: 'Standard Exemption (Widowed)',
            amount: 0
          }
        ]
      },
      [FilingStatus.MFS]: {
        brackets: [11925, 48475, 103350, 197300, 250525, 375800],
        deductions: [
          {
            name: 'Standard Deduction (Married Filing Separately)',
            amount: 15750 // Same as Single
          },
          {
            name: 'Standard Deduction (Married Filing Separately) with 1 age or blindness allowance',
            amount: 17350 // $15,750 + $1,600
          },
          {
            name: 'Standard Deduction (Married Filing Separately) with 2 age or blindness allowances',
            amount: 18950 // $15,750 + $3,200
          },
          {
            name: 'Standard Deduction (Married Filing Separately) with 3 age or blindness allowances',
            amount: 20550 // $15,750 + $4,800
          },
          {
            name: 'Standard Deduction (Married Filing Separately) with 4 age or blindness allowances',
            amount: 22150 // $15,750 + $6,400
          }
        ],
        exemptions: [
          {
            name: 'Standard Exemption (Single)',
            amount: 0
          }
        ]
      },
      [FilingStatus.HOH]: {
        // Source: IRS Rev Proc 2024-40 with OBBBA adjustments
        brackets: [17000, 64850, 103350, 197300, 250500, 626350],
        deductions: [
          {
            name: 'Standard Deduction (Head of Household)',
            amount: 23625 // OBBBA Senate 2025: $23,625
          },
          {
            name: 'Standard Deduction (Head of Household) with 1 age or blindness allowance',
            amount: 25625 // $23,625 + $2,000
          },
          {
            name: 'Standard Deduction (Head of Household) with 2 age or blindness allowances',
            amount: 27625 // $23,625 + $4,000
          }
        ],
        exemptions: [
          {
            name: 'Standard Exemption (Single)',
            amount: 0
          }
        ]
      }
    }
  },
  longTermCapGains: {
    rates: [0, 15, 20],
    status: {
      [FilingStatus.S]: {
        brackets: [48350, 533400]
      },
      [FilingStatus.MFJ]: {
        brackets: [96700, 600050]
      },
      [FilingStatus.W]: {
        brackets: [96700, 600050]
      },
      [FilingStatus.MFS]: {
        brackets: [48350, 300000]
      },
      [FilingStatus.HOH]: {
        brackets: [64750, 566700]
      }
    }
  }
}

export const fica = {
  maxSSTax: 10710.6, // Updated for 2025
  maxIncomeSSTaxApplies: 172800, // Updated for 2025

  regularMedicareTaxRate: 1.45 / 100,
  additionalMedicareTaxRate: 0.9 / 100,
  additionalMedicareTaxThreshold: (filingStatus: FilingStatus): number => {
    switch (filingStatus) {
      case FilingStatus.MFJ: {
        return 250000
      }
      case FilingStatus.MFS: {
        return 125000
      }
      default: {
        return 200000 // Single, Head of Household, Widower
      }
    }
  }
}

// Net Investment Income Tax calculated on form 8960
export const netInvestmentIncomeTax = {
  taxRate: 0.038, // 3.8%
  taxThreshold: (filingStatus: FilingStatus): number => {
    switch (filingStatus) {
      case FilingStatus.MFJ: {
        return 250000
      }
      case FilingStatus.W: {
        return 250000
      }
      case FilingStatus.MFS: {
        return 125000
      }
      default: {
        return 200000 // Single, Head of Household
      }
    }
  }
}

export const healthSavingsAccounts = {
  contributionLimit: {
    'self-only': 4300, // Updated for 2025
    family: 8550 // Updated for 2025
  }
}

// =============================================================================
// OBBBA AMT Parameters
// Source: docs/obbba/form-6251-amt/AMT.md
// =============================================================================
export const amt = {
  // OBBBA 2025: AMT exemptions (House version)
  // Source: docs/obbba/form-6251-amt/AMT.md
  exemptionAmount: (filingStatus: FilingStatus): number => {
    switch (filingStatus) {
      case FilingStatus.S:
      case FilingStatus.HOH:
        return 70300 // OBBBA: $70,300 (reduced from TCJA $89,400)
      case FilingStatus.MFJ:
      case FilingStatus.W:
        return 109400 // OBBBA: $109,400 (reduced from TCJA $139,100)
      case FilingStatus.MFS:
        return 54700 // OBBBA: $54,700 (reduced from TCJA $69,500)
    }
  },
  // Phase-out thresholds (House version)
  phaseOutStart: (filingStatus: FilingStatus): number => {
    switch (filingStatus) {
      case FilingStatus.S:
      case FilingStatus.HOH:
      case FilingStatus.MFS:
        return 500000 // Phase-out begins at $500,000
      case FilingStatus.MFJ:
      case FilingStatus.W:
        return 1000000 // Phase-out begins at $1,000,000
    }
  },
  // Phase-out rate: 25 cents per dollar above threshold
  phaseOutRate: 0.25,
  // Calculate exemption after phase-out
  exemption: (filingStatus: FilingStatus, income: number): number => {
    const baseExemption = amt.exemptionAmount(filingStatus)
    const phaseOutStart = amt.phaseOutStart(filingStatus)

    if (income <= phaseOutStart) {
      return baseExemption
    }

    // Phase-out: 25 cents per dollar above threshold
    const excess = income - phaseOutStart
    const phaseOutAmount = excess * amt.phaseOutRate
    const exemption = Math.max(0, baseExemption - phaseOutAmount)

    return exemption
  },

  // Used for calculating Line 7 on form 6251
  cap: (filingStatus: FilingStatus): number => {
    if (filingStatus === FilingStatus.MFS) {
      return 119550
    }
    return 239100
  }
}

// =============================================================================
// OBBBA New Deductions
// Source: docs/obbba/new-provisions/
// =============================================================================

// Overtime Income Exemption - new above-the-line deduction
// Source: docs/obbba/new-provisions/OVERTIME_EXEMPTION.md
export const overtimeExemption = {
  enabled: true,
  // Caps by filing status
  annualCap: (filingStatus: FilingStatus): number => {
    switch (filingStatus) {
      case FilingStatus.MFJ:
        return 25000
      default:
        return 12500
    }
  },
  // Phase-out thresholds (Senate version)
  phaseOutStart: (filingStatus: FilingStatus): number => {
    switch (filingStatus) {
      case FilingStatus.MFJ:
      case FilingStatus.W:
        return 150000
      case FilingStatus.HOH:
        return 125000
      default:
        return 100000
    }
  },
  phaseOutEnd: (filingStatus: FilingStatus): number => {
    switch (filingStatus) {
      case FilingStatus.MFJ:
      case FilingStatus.W:
        return 200000
      case FilingStatus.HOH:
        return 175000
      default:
        return 150000
    }
  }
}

// Tip Income Exemption - new above-the-line deduction
// Source: docs/obbba/new-provisions/TIP_INCOME_EXEMPTION.md
export const tipIncomeExemption = {
  enabled: true,
  // Senate version: $25,000 cap (House has no cap)
  annualCap: 25000,
  phaseOutStart: (filingStatus: FilingStatus): number => {
    switch (filingStatus) {
      case FilingStatus.MFJ:
      case FilingStatus.W:
        return 150000
      case FilingStatus.HOH:
        return 125000
      default:
        return 100000
    }
  },
  phaseOutEnd: (filingStatus: FilingStatus): number => {
    switch (filingStatus) {
      case FilingStatus.MFJ:
      case FilingStatus.W:
        return 200000
      case FilingStatus.HOH:
        return 175000
      default:
        return 150000
    }
  }
}

// Auto Loan Interest Deduction - new above-the-line deduction
export const autoLoanInterestDeduction = {
  enabled: true,
  annualCap: (filingStatus: FilingStatus): number => {
    return filingStatus === FilingStatus.MFJ ? 20000 : 10000
  },
  phaseOutStart: (filingStatus: FilingStatus): number => {
    return filingStatus === FilingStatus.MFJ ? 200000 : 100000
  },
  phaseOutEnd: (filingStatus: FilingStatus): number => {
    return filingStatus === FilingStatus.MFJ ? 250000 : 125000
  },
  // Only for vehicles manufactured in the USA
  domesticManufactureRequired: true
}

// Senior Additional Deduction (65+)
// Source: docs/obbba/form-1040/STANDARD_DEDUCTION.md
export const seniorAdditionalDeduction = {
  enabled: true,
  amount: 6000, // OBBBA: $6,000 per qualifying person 65+
  minAge: 65,
  // Effective 2025-2028 (sunsets)
  effectiveYears: [2025, 2026, 2027, 2028]
}

// =============================================================================
// OBBBA SALT Cap
// Source: docs/obbba/schedule-a-itemized/SALT_DEDUCTION.md
// =============================================================================
export const saltCap = {
  // OBBBA 2025: SALT cap increased to $40,400 (from $10,000)
  // Source: docs/obbba/schedule-a-itemized/SALT_DEDUCTION.md
  baseAmount: 40400, // Base cap amount
  floorAmount: 10000, // Floor (returns to TCJA cap)
  // Phase-out for high earners: 30% rate, starts at $505,000 AGI
  phaseOutStart: (filingStatus: FilingStatus): number => {
    if (filingStatus === FilingStatus.MFS) {
      return 252500 // MFS: $252,500
    }
    return 505000 // All others: $505,000
  },
  phaseOutRate: 0.3, // 30% reduction per dollar above threshold
  // Calculate effective SALT cap with phase-out
  effectiveCap: (filingStatus: FilingStatus, agi: number): number => {
    const base = saltCap.baseAmount
    const floor = saltCap.floorAmount
    const threshold = saltCap.phaseOutStart(filingStatus)

    if (agi <= threshold) {
      return base // Full cap applies
    }

    // Phase-out: reduce by 30% of excess over threshold
    const excess = agi - threshold
    const reduction = excess * saltCap.phaseOutRate
    const effective = Math.max(floor, base - reduction)

    return effective
  }
}

// =============================================================================
// EITC Parameters (updated for 2025 - Senate Finance Version)
// Source: IRS Rev Proc 2024-40 with OBBBA adjustments
// =============================================================================
const line11Caps = [19104, 50434, 57310, 61555]
const line11MfjCaps = [26214, 57554, 64430, 68675]

type Point = [number, number]

const toPieceWise = (points: Point[]): Piecewise =>
  points
    .slice(0, points.length - 1)
    .map((point, idx) => [point, points[idx + 1]])
    .map(([[x1, y1], [x2, y2]]) => ({
      lowerBound: x1,
      f: linear((y2 - y1) / (x2 - x1), y1 - (x1 * (y2 - y1)) / (x2 - x1))
    }))

// Updated EITC formulas for 2025
const unmarriedFormulas: Piecewise[] = (() => {
  const points: Point[][] = [
    [
      [0, 0],
      [8050, 616],
      [10070, 616],
      [18128, 0]
    ],
    [
      [0, 0],
      [12075, 4105],
      [22160, 4105],
      [47835, 0]
    ],
    [
      [0, 0],
      [16965, 6784],
      [22160, 6784],
      [54383, 0]
    ],
    [
      [0, 0],
      [16965, 7633],
      [22160, 7633],
      [58411, 0]
    ]
  ]
  return points.map((ps: Point[]) => toPieceWise(ps))
})()

const marriedFormulas: Piecewise[] = (() => {
  const points: Point[][] = [
    [
      [0, 0],
      [8050, 616],
      [16820, 4105],
      [24880, 0]
    ],
    [
      [0, 0],
      [12075, 4105],
      [28890, 4105],
      [54595, 0]
    ],
    [
      [0, 0],
      [16965, 6784],
      [28890, 6784],
      [61143, 0]
    ],
    [
      [0, 0],
      [16965, 7633],
      [28890, 7633],
      [65171, 0]
    ]
  ]
  return points.map((ps) => toPieceWise(ps))
})()

interface EICDef {
  caps: { [k in FilingStatus]: number[] | undefined }
  maxInvestmentIncome: number
  formulas: { [k in FilingStatus]: Piecewise[] | undefined }
}

export const QualifyingDependents = {
  childMaxAge: 17,
  qualifyingDependentMaxAge: 19,
  qualifyingStudentMaxAge: 24
}

export const EIC: EICDef = {
  caps: {
    [FilingStatus.S]: line11Caps,
    [FilingStatus.W]: line11Caps,
    [FilingStatus.HOH]: line11Caps,
    [FilingStatus.MFS]: undefined,
    [FilingStatus.MFJ]: line11MfjCaps
  },
  maxInvestmentIncome: 11950, // Updated for 2025 (IRS Rev Proc 2024-40)
  formulas: {
    [FilingStatus.S]: unmarriedFormulas,
    [FilingStatus.W]: unmarriedFormulas,
    [FilingStatus.HOH]: unmarriedFormulas,
    [FilingStatus.MFS]: undefined,
    [FilingStatus.MFJ]: marriedFormulas
  }
}

export default federalBrackets

// Social security benefits worksheet constants
interface SocialSecurityBenefitsDef {
  caps: { [k in FilingStatus]: { l8: number; l10: number } }
}

export const SSBenefits: SocialSecurityBenefitsDef = {
  caps: {
    [FilingStatus.S]: { l8: 25000, l10: 9000 },
    [FilingStatus.W]: { l8: 25000, l10: 9000 },
    [FilingStatus.HOH]: { l8: 25000, l10: 9000 },
    [FilingStatus.MFS]: { l8: 25000, l10: 9000 },
    [FilingStatus.MFJ]: { l8: 32000, l10: 12000 }
  }
}

// =============================================================================
// OBBBA Child Tax Credit Parameters (Senate Finance Version)
// Source: docs/obbba/form-8812-ctc/CTC.md
// =============================================================================
export const childTaxCredit = {
  // OBBBA Senate version: $2,200 per qualifying child (under 17) for 2025-2026
  // Graduates to $2,700 by 2035
  amountPerChild: 2200,
  // OBBBA: $500 for other dependents (unchanged)
  amountPerOtherDependent: 500,
  // Baby Bonus: Additional $1,000 for children born in tax year
  babyBonus: 1000,
  // Refundable portion (ACTC) - max per child
  refundableAmount: 1700, // 2025-2026: $1,700 (increases in later years)
  // Phase-in threshold for refundable portion
  phaseInThreshold: 2500,
  // Phase-in rate
  phaseInRate: 0.15, // 15% of earned income above threshold
  // Phase-out thresholds
  phaseOutStart: (filingStatus: FilingStatus): number => {
    return filingStatus === FilingStatus.MFJ ? 400000 : 200000
  },
  // Phase-out rate: $50 reduction per $1,000 over threshold
  phaseOutRate: 0.05,
  // Qualifying child max age
  maxAge: 17
}

// =============================================================================
// OBBBA Qualified Business Income Deduction (QBID)
// Source: docs/obbba/schedule-c-qbid/QBID.md
// =============================================================================
export const qbid = {
  // OBBBA House version: 23% rate (up from 20% TCJA)
  maxRate: 0.23,
  // W-2 wage limitation
  w2WageLimitRate: 0.5,
  w2WageAltRate: 0.25,
  qualifiedPropertyRate: 0.025,
  // Phase-out thresholds (House version)
  phaseOutStart: (filingStatus: FilingStatus): number => {
    switch (filingStatus) {
      case FilingStatus.MFJ:
      case FilingStatus.W:
        return 400600
      default:
        return 200300
    }
  },
  phaseOutLength: (filingStatus: FilingStatus): number => {
    switch (filingStatus) {
      case FilingStatus.MFJ:
      case FilingStatus.W:
        return 100000
      default:
        return 50000
    }
  }
}

// =============================================================================
// Trump/MAGA Savings Account (new provision)
// Source: docs/obbba/new-provisions/TRUMP_ACCOUNT.md
// =============================================================================
export const trumpSavingsAccount = {
  enabled: true,
  // Initial government contribution for children born 2025+
  initialContribution: 1000,
  // Annual contribution limit
  annualContributionLimit: 5000,
  // Age limit for beneficiary
  maxBeneficiaryAge: 18,
  // Must be US citizen
  citizenshipRequired: true
}
