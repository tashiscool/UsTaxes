import Form from 'ustaxes/core/irsForms/Form'
import {
  BusinessEntity,
  Form1120SData,
  Form1065Data,
  Form1120Data,
  State
} from 'ustaxes/core/data'

/**
 * Base class for business entity tax returns (1120, 1120-S, 1065, etc.)
 *
 * Unlike F1040Attachment, these forms are standalone returns
 * for business entities rather than attachments to individual returns.
 */
export abstract class BusinessForm extends Form {
  abstract get entityData(): BusinessEntity

  isNeeded = (): boolean => true
  copies = (): BusinessForm[] => []

  // Common entity information methods
  entityName = (): string => this.entityData.entityName
  ein = (): string => this.entityData.ein
  address = (): string => this.entityData.address.address
  city = (): string => this.entityData.address.city
  state = (): State | undefined => this.entityData.address.state
  zip = (): string | undefined => this.entityData.address.zip

  addressLine = (): string => {
    const addr = this.entityData.address
    return `${addr.city}, ${addr.state ?? ''} ${addr.zip ?? ''}`.trim()
  }

  principalBusinessActivity = (): string =>
    this.entityData.principalBusinessActivity
  principalProductOrService = (): string =>
    this.entityData.principalProductOrService
  accountingMethod = (): 'cash' | 'accrual' | 'other' =>
    this.entityData.accountingMethod
  taxYear = (): number => this.entityData.taxYear
  totalAssets = (): number => this.entityData.totalAssets

  // Date formatting helpers
  formatDate = (date: Date | undefined): string => {
    if (!date) return ''
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    })
  }
}

/**
 * Base class for S-Corporation Form 1120-S
 */
export abstract class SCorpForm extends BusinessForm {
  abstract data: Form1120SData
  get entityData(): BusinessEntity {
    return this.data.entity
  }
}

/**
 * Base class for C-Corporation Form 1120
 */
export abstract class CCorpForm extends BusinessForm {
  abstract data: Form1120Data
  get entityData(): BusinessEntity {
    return this.data.entity
  }
}

/**
 * Base class for Partnership Form 1065
 */
export abstract class PartnershipForm extends BusinessForm {
  abstract data: Form1065Data
  get entityData(): BusinessEntity {
    return this.data.entity
  }
}

export default BusinessForm
