/**
 * E-File Wizard Component
 *
 * Step-by-step wizard for electronically filing tax returns.
 * Guides users through:
 * 1. Return summary review
 * 2. Identity verification
 * 3. Bank account for refund/payment
 * 4. Electronic signature
 * 5. Submission and acknowledgment
 * 6. Confirmation or error handling
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars */

import { ReactElement, useState, useCallback, useEffect } from 'react'
import { Helmet } from 'react-helmet'
import { useSelector } from 'react-redux'
import {
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Typography,
  Paper,
  Box,
  Button,
  Grid,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles'
import NavigateNextIcon from '@material-ui/icons/NavigateNext'
import NavigateBeforeIcon from '@material-ui/icons/NavigateBefore'
import SendIcon from '@material-ui/icons/Send'
import WarningIcon from '@material-ui/icons/Warning'

import { YearsTaxesState } from 'ustaxes/redux/data'
import { Information, Refund } from 'ustaxes/core/data'
import {
  IdentityVerification,
  IdentityVerificationData
} from './IdentityVerification'
import { ESignature, ESignatureData } from './ESignature'
import { EFileStatus } from './EFileStatus'
import { LabeledInput, LabeledRadio } from '../input'
import { Patterns } from '../Patterns'
import { useForm, FormProvider } from 'react-hook-form'

import {
  EFileTransmitter,
  TransmitterConfig,
  EFileResult,
  EFileStep,
  PreparedReturn,
  IdentityVerification as IdentityVerificationType,
  ESignature as ESignatureType
} from '../../efile/mef/transmitter'
import { createDefaultMeFConfig } from '../../efile/types/mefTypes'

// =============================================================================
// Styles
// =============================================================================

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      maxWidth: 900,
      margin: '0 auto'
    },
    paper: {
      padding: theme.spacing(3),
      marginBottom: theme.spacing(2)
    },
    stepper: {
      backgroundColor: 'transparent'
    },
    stepContent: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2)
    },
    buttonContainer: {
      display: 'flex',
      gap: theme.spacing(2),
      marginTop: theme.spacing(3)
    },
    summaryGrid: {
      marginTop: theme.spacing(2)
    },
    summaryItem: {
      marginBottom: theme.spacing(2)
    },
    summaryLabel: {
      color: theme.palette.text.secondary,
      fontSize: '0.875rem'
    },
    summaryValue: {
      fontWeight: 500
    },
    refundAmount: {
      color: theme.palette.success.main,
      fontWeight: 600,
      fontSize: '1.5rem'
    },
    owedAmount: {
      color: theme.palette.error.main,
      fontWeight: 600,
      fontSize: '1.5rem'
    },
    divider: {
      margin: theme.spacing(2, 0)
    },
    loadingContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(6),
      gap: theme.spacing(2)
    },
    progressText: {
      marginTop: theme.spacing(2)
    }
  })
)

// =============================================================================
// Types
// =============================================================================

interface WizardStep {
  label: string
  description: string
}

const WIZARD_STEPS: WizardStep[] = [
  {
    label: 'Review Return',
    description: 'Review your tax return summary before filing'
  },
  {
    label: 'Verify Identity',
    description: 'Verify your identity with prior year information'
  },
  {
    label: 'Bank Account',
    description: 'Enter bank account for refund or payment'
  },
  {
    label: 'Sign Return',
    description: 'Electronically sign your tax return'
  },
  {
    label: 'Submit',
    description: 'Submit your return to the IRS'
  },
  {
    label: 'Confirmation',
    description: 'View your filing confirmation'
  }
]

// =============================================================================
// Component
// =============================================================================

export function EFileWizard(): ReactElement {
  const classes = useStyles()

  // Redux state
  const taxYear = useSelector((state: YearsTaxesState) => state.activeYear)
  const information = useSelector(
    (state: YearsTaxesState) => state[state.activeYear]
  )
  const refundInfo = useSelector(
    (state: YearsTaxesState) => state[state.activeYear].refund
  )

  // Local state
  const [activeStep, setActiveStep] = useState(0)
  const [identityData, setIdentityData] =
    useState<IdentityVerificationData | null>(null)
  const [signatureData, setSignatureData] = useState<ESignatureData | null>(
    null
  )
  const [bankData, setBankData] = useState<Partial<Refund>>(refundInfo || {})
  const [efileResult, setEfileResult] = useState<EFileResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitProgress, setSubmitProgress] = useState(0)
  const [submitMessage, setSubmitMessage] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form for bank account
  const bankMethods = useForm<Refund>({
    defaultValues: {
      routingNumber: refundInfo?.routingNumber || '',
      accountNumber: refundInfo?.accountNumber || '',
      accountType: refundInfo?.accountType
    }
  })

  // Calculate amounts (mock for now - in real app would come from F1040)
  const taxLiability = 5000 // Mock value
  const totalPayments = 6500 // Mock value
  const refundAmount =
    totalPayments > taxLiability ? totalPayments - taxLiability : 0
  const amountOwed =
    taxLiability > totalPayments ? taxLiability - totalPayments : 0

  const primaryPerson = information.taxPayer.primaryPerson
  const spouse = information.taxPayer.spouse
  const isJoint = information.taxPayer.filingStatus === 'MFJ'

  // Prior tax year
  const priorTaxYear = String(parseInt(taxYear.replace('Y', '')) - 1)

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  // Handle step navigation
  const handleNext = () => {
    setActiveStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1))
  }

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0))
  }

  // Handle identity data change
  const handleIdentityChange = (data: IdentityVerificationData) => {
    setIdentityData(data)
  }

  // Handle signature
  const handleSign = (data: ESignatureData) => {
    setSignatureData(data)
  }

  // Handle bank data
  const handleBankSubmit = (data: Refund) => {
    setBankData(data)
    handleNext()
  }

  // Check if step is complete
  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 0: // Review
        return true // Always can proceed
      case 1: // Identity
        return identityData !== null
      case 2: // Bank
        return !!(
          bankData.routingNumber &&
          bankData.accountNumber &&
          bankData.accountType
        )
      case 3: // Signature
        return signatureData !== null && signatureData.form8879Consent
      case 4: // Submit
        return efileResult !== null
      case 5: // Confirmation
        return true
      default:
        return false
    }
  }

  // Handle submit
  const handleSubmit = async () => {
    setShowConfirmDialog(false)
    setIsSubmitting(true)
    setError(null)

    try {
      // Create transmitter config
      const transmitterConfig: TransmitterConfig = {
        taxYear: taxYear.replace('Y', ''),
        isTest: true, // Always test for now
        mefConfig: createDefaultMeFConfig(
          'ATS',
          {
            etin: 'TEST1',
            efin: '000000',
            softwareId: 'USTAXES1',
            transmitterName: 'UsTaxes',
            credentials: {
              etin: 'TEST1',
              appPassword: '',
              certificate: {
                certificateData: '',
                format: 'PEM',
                expirationDate: new Date(),
                serialNumber: '',
                subjectDN: '',
                issuerDN: ''
              },
              privateKey: ''
            }
          },
          {
            minVersion: 'TLSv1.2',
            certPath: '',
            keyPath: '',
            rejectUnauthorized: true
          }
        )
      }

      const transmitter = new EFileTransmitter(transmitterConfig)

      // Set status callback
      transmitter.setStatusCallback(
        (step: EFileStep, message: string, progress?: number) => {
          setSubmitMessage(message)
          if (progress !== undefined) {
            setSubmitProgress(progress)
          }
        }
      )

      // Build identity verification
      const identity: IdentityVerificationType = {
        primaryPriorYearAGI: identityData?.primaryPriorYearAGI
          ? parseFloat(identityData.primaryPriorYearAGI.replace(/[$,]/g, ''))
          : undefined,
        primaryPriorYearPIN: identityData?.primaryPriorYearPIN,
        spousePriorYearAGI: identityData?.spousePriorYearAGI
          ? parseFloat(identityData.spousePriorYearAGI.replace(/[$,]/g, ''))
          : undefined,
        spousePriorYearPIN: identityData?.spousePriorYearPIN,
        primaryIPPIN: identityData?.primaryIPPIN,
        spouseIPPIN: identityData?.spouseIPPIN
      }

      // Build signature
      const signature: ESignatureType = {
        primaryPIN: signatureData?.primaryPIN || '',
        spousePIN: signatureData?.spousePIN,
        signatureDate: new Date(),
        form8879Consent: signatureData?.form8879Consent || false
      }

      // Mock F1040 data for demo
      const mockF1040 = {
        schedules: () => [{ tag: '1040', fields: () => [] }],
        info: {
          taxPayer: {
            primaryPerson: {
              firstName: primaryPerson?.firstName || 'John',
              lastName: primaryPerson?.lastName || 'Doe',
              ssid: primaryPerson?.ssid || '123-45-6789',
              address: {
                address: primaryPerson?.address.address || '123 Main St',
                city: primaryPerson?.address.city || 'Anytown',
                state: primaryPerson?.address.state || 'CA',
                zip: primaryPerson?.address.zip || '12345'
              }
            },
            spouse: spouse
              ? {
                  firstName: spouse.firstName,
                  lastName: spouse.lastName,
                  ssid: spouse.ssid
                }
              : undefined,
            filingStatus: information.taxPayer.filingStatus || 'S'
          },
          refund: bankData as Refund
        },
        l24: () => taxLiability,
        l33: () => totalPayments,
        l34: () => refundAmount,
        l37: () => amountOwed
      }

      // Execute e-file
      const result = await transmitter.eFile(mockF1040, identity, signature)
      setEfileResult(result)

      if (result.success) {
        handleNext()
      } else if (result.currentStep === 'rejected') {
        handleNext() // Go to confirmation to show rejection
      } else {
        setError(result.error?.message || 'An error occurred during submission')
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // Render step content
  const renderStepContent = (step: number): ReactElement => {
    switch (step) {
      case 0: // Review Return
        return (
          <Paper className={classes.paper} elevation={2}>
            <Typography variant="h6" gutterBottom>
              Tax Return Summary
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Please review your return information before proceeding with
              e-file.
            </Typography>

            <Grid container spacing={3} className={classes.summaryGrid}>
              <Grid item xs={12} sm={6}>
                <Box className={classes.summaryItem}>
                  <Typography className={classes.summaryLabel}>
                    Tax Year
                  </Typography>
                  <Typography className={classes.summaryValue}>
                    {taxYear.replace('Y', '')}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box className={classes.summaryItem}>
                  <Typography className={classes.summaryLabel}>
                    Filing Status
                  </Typography>
                  <Typography className={classes.summaryValue}>
                    {information.taxPayer.filingStatus || 'Not specified'}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box className={classes.summaryItem}>
                  <Typography className={classes.summaryLabel}>
                    Primary Taxpayer
                  </Typography>
                  <Typography className={classes.summaryValue}>
                    {primaryPerson
                      ? `${primaryPerson.firstName} ${primaryPerson.lastName}`
                      : 'Not specified'}
                  </Typography>
                </Box>
              </Grid>

              {isJoint && spouse && (
                <Grid item xs={12} sm={6}>
                  <Box className={classes.summaryItem}>
                    <Typography className={classes.summaryLabel}>
                      Spouse
                    </Typography>
                    <Typography className={classes.summaryValue}>
                      {spouse.firstName} {spouse.lastName}
                    </Typography>
                  </Box>
                </Grid>
              )}

              <Grid item xs={12}>
                <Divider className={classes.divider} />
              </Grid>

              <Grid item xs={12} sm={4}>
                <Box className={classes.summaryItem}>
                  <Typography className={classes.summaryLabel}>
                    Total Tax
                  </Typography>
                  <Typography className={classes.summaryValue}>
                    {formatCurrency(taxLiability)}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={4}>
                <Box className={classes.summaryItem}>
                  <Typography className={classes.summaryLabel}>
                    Total Payments
                  </Typography>
                  <Typography className={classes.summaryValue}>
                    {formatCurrency(totalPayments)}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={4}>
                <Box className={classes.summaryItem}>
                  <Typography className={classes.summaryLabel}>
                    {refundAmount > 0 ? 'Refund Amount' : 'Amount Owed'}
                  </Typography>
                  <Typography
                    className={
                      refundAmount > 0
                        ? classes.refundAmount
                        : classes.owedAmount
                    }
                  >
                    {refundAmount > 0
                      ? formatCurrency(refundAmount)
                      : formatCurrency(amountOwed)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {!primaryPerson && (
              <Alert severity="warning" style={{ marginTop: 16 }}>
                Please complete your taxpayer information before e-filing.
              </Alert>
            )}
          </Paper>
        )

      case 1: // Identity Verification
        return (
          <IdentityVerification
            isJoint={isJoint}
            primaryName={
              primaryPerson
                ? `${primaryPerson.firstName} ${primaryPerson.lastName}`
                : 'Taxpayer'
            }
            spouseName={
              spouse ? `${spouse.firstName} ${spouse.lastName}` : undefined
            }
            priorTaxYear={priorTaxYear}
            initialValues={identityData || undefined}
            onChange={handleIdentityChange}
          />
        )

      case 2: // Bank Account
        return (
          <FormProvider {...bankMethods}>
            <form
              onSubmit={(e) => {
                void bankMethods.handleSubmit(handleBankSubmit)(e)
              }}
            >
              <Paper className={classes.paper} elevation={2}>
                <Typography variant="h6" gutterBottom>
                  {refundAmount > 0
                    ? 'Refund Direct Deposit'
                    : 'Payment Information'}
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  {refundAmount > 0
                    ? 'Enter your bank account information for direct deposit of your refund.'
                    : 'Enter your bank account information for electronic payment.'}
                </Typography>

                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <LabeledInput
                      label="Routing Number"
                      name="routingNumber"
                      patternConfig={Patterns.bankRouting}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <LabeledInput
                      label="Account Number"
                      name="accountNumber"
                      patternConfig={Patterns.bankAccount}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <LabeledRadio<Refund>
                      label="Account Type"
                      name="accountType"
                      values={[
                        ['Checking', 'checking'],
                        ['Savings', 'savings']
                      ]}
                    />
                  </Grid>
                </Grid>

                <Box className={classes.buttonContainer}>
                  <Button
                    variant="outlined"
                    onClick={handleBack}
                    startIcon={<NavigateBeforeIcon />}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    endIcon={<NavigateNextIcon />}
                  >
                    Continue
                  </Button>
                </Box>
              </Paper>
            </form>
          </FormProvider>
        )

      case 3: // Sign Return
        return (
          <ESignature
            isJoint={isJoint}
            primaryName={
              primaryPerson
                ? `${primaryPerson.firstName} ${primaryPerson.lastName}`
                : 'Taxpayer'
            }
            spouseName={
              spouse ? `${spouse.firstName} ${spouse.lastName}` : undefined
            }
            taxYear={taxYear.replace('Y', '')}
            refundAmount={refundAmount}
            amountOwed={amountOwed}
            initialValues={signatureData || undefined}
            onSign={handleSign}
          />
        )

      case 4: // Submit
        if (isSubmitting) {
          return (
            <Paper className={classes.paper} elevation={2}>
              <Box className={classes.loadingContainer}>
                <CircularProgress size={60} />
                <Typography variant="h6" className={classes.progressText}>
                  {submitMessage || 'Processing...'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {submitProgress}% complete
                </Typography>
              </Box>
            </Paper>
          )
        }

        return (
          <Paper className={classes.paper} elevation={2}>
            <Typography variant="h6" gutterBottom>
              Ready to Submit
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Your return is ready to be submitted to the IRS. Please review the
              following before clicking Submit.
            </Typography>

            <Alert severity="info" style={{ marginBottom: 16 }}>
              <Typography variant="body2">
                <strong>Important:</strong> Once submitted, you cannot make
                changes. If errors are found, you will need to file an amended
                return (Form 1040-X).
              </Typography>
            </Alert>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="textSecondary">
                  Taxpayer
                </Typography>
                <Typography variant="body1">
                  {primaryPerson
                    ? `${primaryPerson.firstName} ${primaryPerson.lastName}`
                    : 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="textSecondary">
                  {refundAmount > 0 ? 'Refund' : 'Amount Due'}
                </Typography>
                <Typography variant="body1">
                  {refundAmount > 0
                    ? formatCurrency(refundAmount)
                    : formatCurrency(amountOwed)}
                </Typography>
              </Grid>
            </Grid>

            {error && (
              <Alert severity="error" style={{ marginTop: 16 }}>
                {error}
              </Alert>
            )}

            <Box className={classes.buttonContainer}>
              <Button
                variant="outlined"
                onClick={handleBack}
                startIcon={<NavigateBeforeIcon />}
              >
                Back
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={() => setShowConfirmDialog(true)}
                startIcon={<SendIcon />}
                disabled={!signatureData?.form8879Consent}
              >
                Submit to IRS
              </Button>
            </Box>
          </Paper>
        )

      case 5: // Confirmation
        return (
          <EFileStatus
            submissionId={efileResult?.submission?.submissionId}
            status={
              efileResult?.currentStep === 'accepted'
                ? 'Accepted'
                : efileResult?.currentStep === 'rejected'
                ? 'Rejected'
                : 'Pending'
            }
            acknowledgment={efileResult?.acknowledgment?.acknowledgment}
            taxYear={taxYear.replace('Y', '')}
            primaryName={
              primaryPerson
                ? `${primaryPerson.firstName} ${primaryPerson.lastName}`
                : 'Taxpayer'
            }
            refundAmount={refundAmount}
            amountOwed={amountOwed}
            electronicPostmark={efileResult?.submission?.electronicPostmark}
          />
        )

      default:
        return <Typography>Unknown step</Typography>
    }
  }

  return (
    <Box className={classes.root}>
      <Helmet>
        <title>E-File Your Return | UsTaxes.org</title>
      </Helmet>

      <Typography variant="h4" gutterBottom>
        E-File Your Tax Return
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Electronically file your {taxYear.replace('Y', '')} federal tax return
        with the IRS.
      </Typography>

      <Stepper
        activeStep={activeStep}
        orientation="vertical"
        className={classes.stepper}
      >
        {WIZARD_STEPS.map((step, index) => (
          <Step key={step.label}>
            <StepLabel>
              <Typography variant="subtitle1">{step.label}</Typography>
            </StepLabel>
            <StepContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {step.description}
              </Typography>
              <Box className={classes.stepContent}>
                {renderStepContent(index)}
              </Box>
              {/* Navigation buttons (except for steps with custom buttons) */}
              {index !== 2 && index !== 4 && index < 5 && (
                <Box className={classes.buttonContainer}>
                  {index > 0 && (
                    <Button
                      variant="outlined"
                      onClick={handleBack}
                      startIcon={<NavigateBeforeIcon />}
                    >
                      Back
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleNext}
                    endIcon={<NavigateNextIcon />}
                    disabled={!isStepComplete(index)}
                  >
                    Continue
                  </Button>
                </Box>
              )}
            </StepContent>
          </Step>
        ))}
      </Stepper>

      {/* Confirmation Dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <WarningIcon color="primary" />
            Confirm Submission
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            You are about to submit your {taxYear.replace('Y', '')} federal tax
            return to the IRS. This action cannot be undone. Are you sure you
            want to proceed?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)} color="default">
            Cancel
          </Button>
          <Button
            onClick={() => {
              void handleSubmit()
            }}
            color="primary"
            variant="contained"
          >
            Yes, Submit My Return
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default EFileWizard
