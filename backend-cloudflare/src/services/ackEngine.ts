import type { Acknowledgment, SubmissionPayload } from '../domain/types'
import { isValidFilingStatus } from '../utils/filingStatus'
import { isValidReturnFormType } from '../utils/formType'

const ACCEPT: Acknowledgment = {
  status: 'accepted',
  ackCode: 'A',
  ackMessage: 'Accepted by local MeF-compatible validation pipeline',
  rejectionCodes: []
}

const normalizeTin = (value: string): string => value.replace(/\D/g, '')

const isStructurallyValidTin = (
  value: string,
  options?: { allowAtsTestTinGroup00?: boolean }
): boolean => {
  const digits = normalizeTin(value)
  if (digits.length !== 9) {
    return false
  }

  const area = Number(digits.slice(0, 3))
  const group = Number(digits.slice(3, 5))
  const serial = Number(digits.slice(5, 9))

  if (area === 0 || area === 666 || area >= 900) {
    return false
  }
  // IRS ATS test scenarios use group "00" in published test SSNs.
  if (group === 0 && options?.allowAtsTestTinGroup00 !== true) {
    return false
  }
  if (serial === 0) {
    return false
  }

  return true
}

const roundToCents = (value: number): number => Math.round(value * 100) / 100

const sameCurrency = (left: number, right: number): boolean =>
  roundToCents(left) === roundToCents(right)

const reject = (ackMessage: string, rejectionCode: string): Acknowledgment => ({
  status: 'rejected',
  ackCode: 'R',
  ackMessage,
  rejectionCodes: [rejectionCode]
})

export const evaluateSubmissionPayload = (
  payload: SubmissionPayload
): Acknowledgment => {
  if (payload.metadata?.simulateTransientFailure === true) {
    throw new Error(
      'Transient transport failure while validating submission payload'
    )
  }

  if (!isValidFilingStatus(payload.filingStatus)) {
    return reject('Rejected: invalid filing status', 'R0000-058')
  }

  const allowAtsTestTinGroup00 =
    payload.metadata?.irsAtsStrictTin === true ||
    typeof payload.metadata?.scenarioId === 'string'

  if (
    !payload.primaryTIN ||
    !isStructurallyValidTin(payload.primaryTIN, { allowAtsTestTinGroup00 })
  ) {
    return reject('Rejected: taxpayer identity verification failed', 'IND-031')
  }

  if (payload.taxYear < 2020 || payload.taxYear > 2100) {
    return reject('Rejected: invalid tax year value', 'R0000-001')
  }

  if (payload.formType && !isValidReturnFormType(payload.formType)) {
    return reject('Rejected: unsupported return form type', 'R0000-904')
  }

  if ((payload.form1040?.totalTax ?? 0) < 0) {
    return reject('Rejected: negative total tax is not permitted', 'F1040-NEG')
  }

  if ((payload.form1040?.totalPayments ?? 0) < 0) {
    return reject(
      'Rejected: negative total payments are not permitted',
      'F1040-PMT-NEG'
    )
  }

  if ((payload.form1040?.refund ?? 0) < 0) {
    return reject(
      'Rejected: negative refund is not permitted',
      'F1040-RFND-NEG'
    )
  }

  if ((payload.form1040?.amountOwed ?? 0) < 0) {
    return reject(
      'Rejected: negative amount owed is not permitted',
      'F1040-OWED-NEG'
    )
  }

  if (
    payload.form1040 &&
    payload.form1040.totalTax === undefined &&
    payload.form1040.totalPayments === undefined
  ) {
    return reject(
      'Rejected: Form 1040 totals are required when form1040 is provided',
      'F1040-TOTALS-MISSING'
    )
  }

  if (payload.form1040) {
    const isExtensionOnly = payload.formType === '4868'
    const refund = payload.form1040.refund ?? 0
    const amountOwed = payload.form1040.amountOwed ?? 0

    if (!isExtensionOnly && refund > 0 && amountOwed > 0) {
      return reject(
        'Rejected: refund and amount owed cannot both be positive',
        'F1040-BAL-DOUBLE'
      )
    }

    if (
      payload.form1040.totalTax !== undefined &&
      payload.form1040.totalPayments !== undefined
    ) {
      const delta = roundToCents(
        payload.form1040.totalPayments - payload.form1040.totalTax
      )

      if (!isExtensionOnly && delta > 0) {
        if (amountOwed > 0) {
          return reject(
            'Rejected: amount owed cannot be positive when payments exceed tax',
            'F1040-OWED-UNEXPECTED'
          )
        }

        if (
          payload.form1040.refund !== undefined &&
          !sameCurrency(payload.form1040.refund, delta)
        ) {
          return reject(
            'Rejected: refund does not reconcile with total tax and total payments',
            'F1040-RFND-MISMATCH'
          )
        }
      }

      if (!isExtensionOnly && delta < 0) {
        const expectedAmountOwed = roundToCents(Math.abs(delta))

        if (refund > 0) {
          return reject(
            'Rejected: refund cannot be positive when tax exceeds payments',
            'F1040-RFND-UNEXPECTED'
          )
        }

        if (
          payload.form1040.amountOwed !== undefined &&
          !sameCurrency(payload.form1040.amountOwed, expectedAmountOwed)
        ) {
          return reject(
            'Rejected: amount owed does not reconcile with total tax and total payments',
            'F1040-OWED-MISMATCH'
          )
        }
      }

      if (!isExtensionOnly && delta === 0 && (refund > 0 || amountOwed > 0)) {
        return reject(
          'Rejected: refund or amount owed must be zero when tax equals payments',
          'F1040-BAL-ZERO-MISMATCH'
        )
      }
    }

    const expected = payload.metadata?.expectedValues
    if (expected) {
      if (
        expected.totalTax !== undefined &&
        (payload.form1040.totalTax === undefined ||
          !sameCurrency(payload.form1040.totalTax, expected.totalTax))
      ) {
        return reject(
          'Rejected: provided total tax does not match ATS expected values',
          'ATS-TAX-MISMATCH'
        )
      }

      if (
        expected.totalPayments !== undefined &&
        (payload.form1040.totalPayments === undefined ||
          !sameCurrency(payload.form1040.totalPayments, expected.totalPayments))
      ) {
        return reject(
          'Rejected: provided total payments do not match ATS expected values',
          'ATS-PAYMENTS-MISMATCH'
        )
      }

      if (
        !isExtensionOnly &&
        expected.refund !== undefined &&
        (payload.form1040.refund === undefined ||
          !sameCurrency(payload.form1040.refund, expected.refund))
      ) {
        return reject(
          'Rejected: provided refund does not match ATS expected values',
          'ATS-REFUND-MISMATCH'
        )
      }

      if (
        !isExtensionOnly &&
        expected.amountOwed !== undefined &&
        (payload.form1040.amountOwed === undefined ||
          !sameCurrency(payload.form1040.amountOwed, expected.amountOwed))
      ) {
        return reject(
          'Rejected: provided amount owed does not match ATS expected values',
          'ATS-AMOUNT-OWED-MISMATCH'
        )
      }
    }
  }

  return ACCEPT
}
