import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'

/**
 * Form W-2G - Certain Gambling Winnings
 *
 * Reports gambling winnings from:
 * - Casinos
 * - Racetracks
 * - Lotteries
 * - Sweepstakes
 * - Poker tournaments
 * - Slot machines
 *
 * Reporting thresholds:
 * - $1,200 or more from bingo or slot machines
 * - $1,500 or more from keno
 * - $5,000 or more from poker tournaments
 * - $600 or more if at least 300x the wager
 */

export interface W2GData {
  // Payer information
  payerName: string
  payerAddress: string
  payerTIN: string
  payerPhone: string
  // Winner information
  winnerName: string
  winnerAddress: string
  winnerSSN: string
  // Winnings details
  grossWinnings: number // Box 1
  dateWon: Date // Box 2
  typeOfWager: string // Box 3
  federalIncomeTaxWithheld: number // Box 4
  transactionDescription: string // Box 5
  race?: string // Box 6
  winningsFromIdenticalWagers: number // Box 7
  cashier?: string // Box 8
  winnerTINType: 'SSN' | 'EIN' // Box 9
  windowNumber?: string // Box 10
  firstId?: string // Box 11
  secondId?: string // Box 12
  stateWinnings?: number // Box 13
  stateIncomeTaxWithheld?: number // Box 14
  state?: string // Box 15
  statePayerId?: string // Box 16
  localWinnings?: number // Box 17
  localIncomeTaxWithheld?: number // Box 18
  localityName?: string // Box 19
}

// Wager type codes
const WAGER_TYPES: Record<string, string> = {
  SL: 'Slot machines',
  BG: 'Bingo',
  KN: 'Keno',
  PK: 'Poker tournaments',
  HR: 'Horse racing',
  DR: 'Dog racing',
  JA: 'Jai alai',
  LO: 'Lottery',
  SW: 'Sweepstakes',
  OT: 'Other'
}

export default class W2G extends F1040Attachment {
  tag: FormTag = 'w2g'
  sequenceIndex = 999

  isNeeded = (): boolean => {
    return this.hasW2GData()
  }

  hasW2GData = (): boolean => {
    return false
  }

  w2gData = (): W2GData | undefined => {
    return undefined
  }

  // Box 1: Gross winnings
  grossWinnings = (): number => {
    return this.w2gData()?.grossWinnings ?? 0
  }

  // Box 4: Federal income tax withheld
  federalIncomeTaxWithheld = (): number => {
    return this.w2gData()?.federalIncomeTaxWithheld ?? 0
  }

  // Box 7: Winnings from identical wagers
  winningsFromIdenticalWagers = (): number => {
    return this.w2gData()?.winningsFromIdenticalWagers ?? 0
  }

  // Wager type description
  wagerTypeDescription = (): string => {
    const type = this.w2gData()?.typeOfWager ?? ''
    return WAGER_TYPES[type] ?? type
  }

  // Is this a slot machine win?
  isSlotMachine = (): boolean => {
    return this.w2gData()?.typeOfWager === 'SL'
  }

  // Is this a poker tournament win?
  isPokerTournament = (): boolean => {
    return this.w2gData()?.typeOfWager === 'PK'
  }

  // Net winnings (after withholding)
  netWinnings = (): number => {
    return this.grossWinnings() - this.federalIncomeTaxWithheld()
  }

  // State tax withheld
  stateIncomeTaxWithheld = (): number => {
    return this.w2gData()?.stateIncomeTaxWithheld ?? 0
  }

  // Local tax withheld
  localIncomeTaxWithheld = (): number => {
    return this.w2gData()?.localIncomeTaxWithheld ?? 0
  }

  // Total tax withheld
  totalTaxWithheld = (): number => {
    return (
      this.federalIncomeTaxWithheld() +
      this.stateIncomeTaxWithheld() +
      this.localIncomeTaxWithheld()
    )
  }

  // To Form 1040 Line 1h (Other income)
  to1040Line1h = (): number => this.grossWinnings()

  // To Form 1040 Line 25b (Withholding)
  to1040Line25b = (): number => this.federalIncomeTaxWithheld()

  fields = (): Field[] => {
    const data = this.w2gData()

    return [
      // Payer info
      data?.payerName ?? '',
      data?.payerAddress ?? '',
      data?.payerTIN ?? '',
      data?.payerPhone ?? '',
      // Winner info
      data?.winnerName ?? '',
      data?.winnerAddress ?? '',
      data?.winnerSSN ?? '',
      // Winnings
      data?.grossWinnings ?? 0, // Box 1
      data?.dateWon.toLocaleDateString() ?? '', // Box 2
      data?.typeOfWager ?? '', // Box 3
      data?.federalIncomeTaxWithheld ?? 0, // Box 4
      data?.transactionDescription ?? '', // Box 5
      data?.race ?? '', // Box 6
      data?.winningsFromIdenticalWagers ?? 0, // Box 7
      data?.cashier ?? '', // Box 8
      data?.winnerTINType === 'SSN', // Box 9 SSN
      data?.winnerTINType === 'EIN', // Box 9 EIN
      data?.windowNumber ?? '', // Box 10
      data?.firstId ?? '', // Box 11
      data?.secondId ?? '', // Box 12
      // State/Local
      data?.stateWinnings ?? 0, // Box 13
      data?.stateIncomeTaxWithheld ?? 0, // Box 14
      data?.state ?? '', // Box 15
      data?.statePayerId ?? '', // Box 16
      data?.localWinnings ?? 0, // Box 17
      data?.localIncomeTaxWithheld ?? 0, // Box 18
      data?.localityName ?? '', // Box 19
      // Calculations
      this.wagerTypeDescription(),
      this.netWinnings(),
      this.totalTaxWithheld()
    ]
  }
}
