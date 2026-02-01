/**
 * Electronic Signature Component
 *
 * Implements Form 8879 consent and PIN-based electronic signature for e-file.
 * This component displays the consent form, collects PINs, and records the
 * signature timestamp.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { ReactElement, useState, useEffect } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import {
  Grid,
  Typography,
  Paper,
  Box,
  Divider,
  FormControlLabel,
  Checkbox,
  Button
} from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles'
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline'

import { LabeledInput } from '../input'

// =============================================================================
// Styles
// =============================================================================

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    paper: {
      padding: theme.spacing(3),
      marginBottom: theme.spacing(2)
    },
    sectionTitle: {
      marginBottom: theme.spacing(2)
    },
    consentBox: {
      backgroundColor:
        theme.palette.type === 'dark'
          ? 'rgba(255, 255, 255, 0.05)'
          : 'rgba(0, 0, 0, 0.02)',
      padding: theme.spacing(2),
      borderRadius: theme.shape.borderRadius,
      marginBottom: theme.spacing(2),
      maxHeight: 300,
      overflow: 'auto',
      border: `1px solid ${theme.palette.divider}`
    },
    consentText: {
      fontSize: '0.875rem',
      lineHeight: 1.6
    },
    divider: {
      margin: theme.spacing(3, 0)
    },
    pinGrid: {
      marginTop: theme.spacing(2)
    },
    signatureInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginTop: theme.spacing(2),
      padding: theme.spacing(2),
      backgroundColor: theme.palette.success.light + '20',
      borderRadius: theme.shape.borderRadius,
      border: `1px solid ${theme.palette.success.main}`
    },
    signatureIcon: {
      color: theme.palette.success.main
    },
    timestamp: {
      fontFamily: 'monospace',
      fontSize: '0.875rem'
    },
    pinHelp: {
      marginTop: theme.spacing(1)
    },
    submitButton: {
      marginTop: theme.spacing(2)
    },
    checkboxLabel: {
      alignItems: 'flex-start',
      '& .MuiFormControlLabel-label': {
        paddingTop: theme.spacing(1)
      }
    }
  })
)

// =============================================================================
// Types
// =============================================================================

export interface ESignatureData {
  /** Primary taxpayer's 5-digit self-select PIN */
  primaryPIN: string
  /** Spouse's 5-digit self-select PIN (if joint) */
  spousePIN?: string
  /** Form 8879 consent acknowledged */
  form8879Consent: boolean
  /** Consent to e-file */
  efileConsent: boolean
  /** Date/time of signature */
  signatureTimestamp?: string
}

export interface ESignatureProps {
  /** Whether this is a joint return */
  isJoint: boolean
  /** Primary taxpayer name */
  primaryName: string
  /** Spouse name (if joint) */
  spouseName?: string
  /** Tax year being filed */
  taxYear: string
  /** Refund amount (if applicable) */
  refundAmount?: number
  /** Amount owed (if applicable) */
  amountOwed?: number
  /** Initial values */
  initialValues?: Partial<ESignatureData>
  /** Called when signature is complete */
  onSign?: (data: ESignatureData) => void
  /** Whether the form is in read-only mode (already signed) */
  readOnly?: boolean
}

// =============================================================================
// Form 8879 Consent Text
// =============================================================================

const FORM_8879_CONSENT = `
IRS e-file Signature Authorization (Form 8879)

By entering my Self-Select PIN below, I am signing this return electronically and
authorizing the electronic filing of this tax return.

Part I - Tax Return Information
I consent to allow my Electronic Return Originator (ERO) to send my return to the IRS
and to receive the following information from the IRS:
(a) The status of my e-filed return
(b) The date the IRS received my return
(c) The date any refund was issued

Part II - Declaration and Signature Authorization
Under penalties of perjury, I declare that the amounts shown on this return and
accompanying schedules and statements, to the best of my knowledge and belief, are
true, correct, and complete.

I consent to allow my ERO, and/or the ERO's firm, to send my return to the IRS and to
receive from the IRS:
(a) An acknowledgement of receipt or reason for rejection of the transmission
(b) The reason for any delay in processing the return or refund
(c) The date of any refund

I authorize the ERO to enter or generate my PIN as my signature on my tax return and
as my signature on Form 8879. I authorize the U.S. Treasury and its designated
Financial Agent to initiate an electronic funds withdrawal from the financial
institution account indicated on this return for payment of my federal taxes owed on
this return, and the financial institution to debit the entry to this account.

Declaration of ERO
I declare that I have reviewed the above taxpayer's return and that the entries on
Form 8879 are complete and correct to the best of my knowledge.

PIN Selection
Select a 5-digit Personal Identification Number (PIN) to use as your signature on
your electronically filed tax return. The PIN can be any five numbers (except all
zeros) that you choose. You will use this PIN to sign your return.
`

// =============================================================================
// Component
// =============================================================================

export function ESignature({
  isJoint,
  primaryName,
  spouseName,
  taxYear,
  refundAmount,
  amountOwed,
  initialValues,
  onSign,
  readOnly = false
}: ESignatureProps): ReactElement {
  const classes = useStyles()

  const [isSigned, setIsSigned] = useState(!!initialValues?.signatureTimestamp)
  const [signatureTimestamp, setSignatureTimestamp] = useState<
    string | undefined
  >(initialValues?.signatureTimestamp)

  const defaultValues: ESignatureData = {
    primaryPIN: '',
    spousePIN: '',
    form8879Consent: false,
    efileConsent: false,
    ...initialValues
  }

  const methods = useForm<ESignatureData>({ defaultValues })
  const {
    handleSubmit,
    watch,
    formState: { errors }
  } = methods

  const form8879Consent = watch('form8879Consent')
  const efileConsent = watch('efileConsent')
  const primaryPIN = watch('primaryPIN')
  const spousePIN = watch('spousePIN')

  // Check if form is complete
  const isComplete =
    form8879Consent &&
    efileConsent &&
    /^\d{5}$/.test(primaryPIN) &&
    (!isJoint || /^\d{5}$/.test(spousePIN || ''))

  const handleSign = (data: ESignatureData) => {
    const timestamp = new Date().toISOString()
    setSignatureTimestamp(timestamp)
    setIsSigned(true)

    const signatureData: ESignatureData = {
      ...data,
      signatureTimestamp: timestamp
    }

    if (onSign) {
      onSign(signatureData)
    }
  }

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={(e) => void handleSubmit(handleSign)(e)}>
        {/* Return Summary */}
        <Paper className={classes.paper} elevation={2}>
          <Typography variant="h6" className={classes.sectionTitle}>
            Tax Year {taxYear} Return Summary
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="body2" color="textSecondary">
                Taxpayer
              </Typography>
              <Typography variant="body1">{primaryName}</Typography>
              {isJoint && spouseName && (
                <Typography variant="body1">{spouseName}</Typography>
              )}
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="textSecondary">
                {refundAmount && refundAmount > 0
                  ? 'Refund Amount'
                  : 'Amount Owed'}
              </Typography>
              <Typography
                variant="h5"
                color={refundAmount && refundAmount > 0 ? 'primary' : 'error'}
              >
                {refundAmount && refundAmount > 0
                  ? formatCurrency(refundAmount)
                  : formatCurrency(amountOwed || 0)}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Form 8879 Consent */}
        <Paper className={classes.paper} elevation={2}>
          <Typography variant="h6" className={classes.sectionTitle}>
            IRS e-file Signature Authorization (Form 8879)
          </Typography>

          <Box className={classes.consentBox}>
            <Typography
              className={classes.consentText}
              component="pre"
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {FORM_8879_CONSENT}
            </Typography>
          </Box>

          <FormControlLabel
            className={classes.checkboxLabel}
            control={
              <Checkbox
                name="form8879Consent"
                checked={form8879Consent}
                onChange={(e) =>
                  methods.setValue('form8879Consent', e.target.checked)
                }
                color="primary"
                disabled={readOnly || isSigned}
              />
            }
            label={
              <Typography variant="body2">
                I have read and agree to the IRS e-file Signature Authorization
                (Form 8879). I understand that by entering my PIN below, I am
                signing my return electronically.
              </Typography>
            }
          />

          <FormControlLabel
            className={classes.checkboxLabel}
            control={
              <Checkbox
                name="efileConsent"
                checked={efileConsent}
                onChange={(e) =>
                  methods.setValue('efileConsent', e.target.checked)
                }
                color="primary"
                disabled={readOnly || isSigned}
              />
            }
            label={
              <Typography variant="body2">
                I consent to electronically file my {taxYear} federal income tax
                return with the Internal Revenue Service.
              </Typography>
            }
          />
        </Paper>

        {/* PIN Entry */}
        <Paper className={classes.paper} elevation={2}>
          <Typography variant="h6" className={classes.sectionTitle}>
            Create Your Electronic Signature PIN
          </Typography>

          <Alert severity="info" style={{ marginBottom: 16 }}>
            Choose any 5-digit PIN (except all zeros). This PIN serves as your
            electronic signature. Remember this PIN if you need to file an
            amended return.
          </Alert>

          <Grid container spacing={3} className={classes.pinGrid}>
            {/* Primary PIN */}
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" gutterBottom>
                {primaryName}&apos;s Signature PIN
              </Typography>
              <LabeledInput
                label="5-Digit PIN"
                name="primaryPIN"
                patternConfig={{
                  inputType: 'numeric',
                  regexp: /^\d{5}$/,
                  description: 'PIN must be exactly 5 digits',
                  format: '#####'
                }}
                rules={{
                  required: 'PIN is required',
                  validate: (value: string) => {
                    if (value === '00000') {
                      return 'PIN cannot be all zeros'
                    }
                    if (!/^\d{5}$/.test(value)) {
                      return 'PIN must be exactly 5 digits'
                    }
                    return true
                  }
                }}
              />
              <Typography
                variant="caption"
                color="textSecondary"
                className={classes.pinHelp}
              >
                Example: 12345 (do not use all zeros)
              </Typography>
            </Grid>

            {/* Spouse PIN (if joint) */}
            {isJoint && spouseName && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" gutterBottom>
                  {spouseName}&apos;s Signature PIN
                </Typography>
                <LabeledInput
                  label="5-Digit PIN"
                  name="spousePIN"
                  patternConfig={{
                    inputType: 'numeric',
                    regexp: /^\d{5}$/,
                    description: 'PIN must be exactly 5 digits',
                    format: '#####'
                  }}
                  rules={{
                    required: 'Spouse PIN is required for joint returns',
                    validate: (value: string) => {
                      if (value === '00000') {
                        return 'PIN cannot be all zeros'
                      }
                      if (!/^\d{5}$/.test(value)) {
                        return 'PIN must be exactly 5 digits'
                      }
                      return true
                    }
                  }}
                />
                <Typography
                  variant="caption"
                  color="textSecondary"
                  className={classes.pinHelp}
                >
                  Spouse must create their own PIN
                </Typography>
              </Grid>
            )}
          </Grid>

          {/* Signature Status */}
          {isSigned && signatureTimestamp && (
            <Box className={classes.signatureInfo}>
              <CheckCircleOutlineIcon className={classes.signatureIcon} />
              <Box>
                <Typography variant="subtitle2">
                  Return Signed Electronically
                </Typography>
                <Typography variant="body2" className={classes.timestamp}>
                  Signed on: {new Date(signatureTimestamp).toLocaleString()}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Sign Button */}
          {!readOnly && !isSigned && (
            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              className={classes.submitButton}
              disabled={!isComplete}
            >
              Sign My Tax Return Electronically
            </Button>
          )}

          {!isComplete && !isSigned && (
            <Typography
              variant="body2"
              color="textSecondary"
              align="center"
              style={{ marginTop: 8 }}
            >
              Please complete all fields above to sign your return
            </Typography>
          )}
        </Paper>

        {/* Legal Notice */}
        <Alert severity="warning">
          <Typography variant="body2">
            <strong>Important:</strong> By signing electronically, you certify
            that all information on your tax return is true, correct, and
            complete to the best of your knowledge. Submitting a false return is
            a federal crime.
          </Typography>
        </Alert>
      </form>
    </FormProvider>
  )
}

export default ESignature
