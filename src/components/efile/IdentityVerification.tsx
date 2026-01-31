/**
 * Identity Verification Component
 *
 * Collects identity verification data required for e-file submission:
 * - Prior year AGI
 * - Prior year self-select PIN
 * - IP PIN (Identity Protection PIN if assigned by IRS)
 * - New self-select PIN creation
 */

import { ReactElement, useState } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import {
  Grid,
  Typography,
  Paper,
  Box,
  Divider,
  FormControlLabel,
  Checkbox,
  Alert,
  Collapse,
  Link,
  Tooltip,
  IconButton
} from '@material-ui/core'
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles'
import HelpOutlineIcon from '@material-ui/icons/HelpOutline'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'

import { LabeledInput } from '../input'
import { Patterns } from '../Patterns'

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
      marginBottom: theme.spacing(2),
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1)
    },
    helpIcon: {
      color: theme.palette.text.secondary,
      fontSize: '1.2rem'
    },
    divider: {
      margin: theme.spacing(3, 0)
    },
    alert: {
      marginBottom: theme.spacing(2)
    },
    pinSection: {
      marginTop: theme.spacing(2)
    },
    infoBox: {
      backgroundColor: theme.palette.type === 'dark'
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(0, 0, 0, 0.02)',
      padding: theme.spacing(2),
      borderRadius: theme.shape.borderRadius,
      marginBottom: theme.spacing(2)
    },
    link: {
      cursor: 'pointer'
    }
  })
)

// =============================================================================
// Types
// =============================================================================

export interface IdentityVerificationData {
  /** Primary taxpayer prior year AGI */
  primaryPriorYearAGI?: string
  /** Primary taxpayer prior year self-select PIN */
  primaryPriorYearPIN?: string
  /** Spouse prior year AGI */
  spousePriorYearAGI?: string
  /** Spouse prior year self-select PIN */
  spousePriorYearPIN?: string
  /** Primary taxpayer IP PIN (if assigned by IRS) */
  primaryIPPIN?: string
  /** Spouse IP PIN (if assigned by IRS) */
  spouseIPPIN?: string
  /** Whether primary has IP PIN */
  primaryHasIPPIN: boolean
  /** Whether spouse has IP PIN */
  spouseHasIPPIN: boolean
  /** Use prior year PIN instead of AGI for primary */
  usePrimaryPriorPIN: boolean
  /** Use prior year PIN instead of AGI for spouse */
  useSpousePriorPIN: boolean
}

export interface IdentityVerificationProps {
  /** Whether this is a joint return */
  isJoint: boolean
  /** Primary taxpayer name */
  primaryName: string
  /** Spouse name (if joint) */
  spouseName?: string
  /** Prior tax year */
  priorTaxYear: string
  /** Initial values */
  initialValues?: Partial<IdentityVerificationData>
  /** Called when form values change */
  onChange?: (data: IdentityVerificationData) => void
  /** Called when form is submitted */
  onSubmit?: (data: IdentityVerificationData) => void
}

// =============================================================================
// Component
// =============================================================================

export function IdentityVerification({
  isJoint,
  primaryName,
  spouseName,
  priorTaxYear,
  initialValues,
  onChange,
  onSubmit
}: IdentityVerificationProps): ReactElement {
  const classes = useStyles()

  const [primaryHasIPPIN, setPrimaryHasIPPIN] = useState(
    initialValues?.primaryHasIPPIN ?? false
  )
  const [spouseHasIPPIN, setSpouseHasIPPIN] = useState(
    initialValues?.spouseHasIPPIN ?? false
  )
  const [usePrimaryPriorPIN, setUsePrimaryPriorPIN] = useState(
    initialValues?.usePrimaryPriorPIN ?? false
  )
  const [useSpousePriorPIN, setUseSpousePriorPIN] = useState(
    initialValues?.useSpousePriorPIN ?? false
  )

  const defaultValues: Partial<IdentityVerificationData> = {
    primaryPriorYearAGI: '',
    primaryPriorYearPIN: '',
    spousePriorYearAGI: '',
    spousePriorYearPIN: '',
    primaryIPPIN: '',
    spouseIPPIN: '',
    primaryHasIPPIN: false,
    spouseHasIPPIN: false,
    usePrimaryPriorPIN: false,
    useSpousePriorPIN: false,
    ...initialValues
  }

  const methods = useForm<IdentityVerificationData>({ defaultValues })
  const { handleSubmit, watch, setValue } = methods

  // Watch form values for onChange callback
  const formValues = watch()

  const handleFormChange = () => {
    if (onChange) {
      onChange({
        ...formValues,
        primaryHasIPPIN,
        spouseHasIPPIN,
        usePrimaryPriorPIN,
        useSpousePriorPIN
      })
    }
  }

  const handleFormSubmit = (data: IdentityVerificationData) => {
    const fullData: IdentityVerificationData = {
      ...data,
      primaryHasIPPIN,
      spouseHasIPPIN,
      usePrimaryPriorPIN,
      useSpousePriorPIN
    }
    if (onSubmit) {
      onSubmit(fullData)
    }
  }

  return (
    <FormProvider {...methods}>
      <form onChange={handleFormChange} onSubmit={handleSubmit(handleFormSubmit)}>
        <Paper className={classes.paper} elevation={2}>
          <Typography variant="h6" className={classes.sectionTitle}>
            Identity Verification for {primaryName}
            <Tooltip title="The IRS requires identity verification to prevent fraudulent filings">
              <HelpOutlineIcon className={classes.helpIcon} />
            </Tooltip>
          </Typography>

          <Box className={classes.infoBox}>
            <Typography variant="body2" color="textSecondary">
              To verify your identity, enter your Adjusted Gross Income (AGI) from
              your {priorTaxYear} tax return. You can find this on Form 1040, Line 11.
              If you didn&apos;t file last year, enter 0.
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {/* Prior Year AGI or PIN */}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={usePrimaryPriorPIN}
                    onChange={(e) => {
                      setUsePrimaryPriorPIN(e.target.checked)
                      if (e.target.checked) {
                        setValue('primaryPriorYearAGI', '')
                      } else {
                        setValue('primaryPriorYearPIN', '')
                      }
                    }}
                    color="primary"
                  />
                }
                label={`Use my ${priorTaxYear} Self-Select PIN instead of AGI`}
              />
            </Grid>

            <Collapse in={!usePrimaryPriorPIN} style={{ width: '100%' }}>
              <Grid item xs={12} sm={6} style={{ paddingLeft: 24, paddingRight: 24 }}>
                <LabeledInput
                  label={`${priorTaxYear} Adjusted Gross Income (AGI)`}
                  name="primaryPriorYearAGI"
                  patternConfig={Patterns.currency}
                />
              </Grid>
            </Collapse>

            <Collapse in={usePrimaryPriorPIN} style={{ width: '100%' }}>
              <Grid item xs={12} sm={6} style={{ paddingLeft: 24, paddingRight: 24 }}>
                <LabeledInput
                  label={`${priorTaxYear} Self-Select PIN (5 digits)`}
                  name="primaryPriorYearPIN"
                  patternConfig={{
                    inputType: 'numeric',
                    regexp: /^\d{5}$/,
                    description: 'PIN must be 5 digits',
                    format: '#####'
                  }}
                />
              </Grid>
            </Collapse>

            {/* IP PIN Section */}
            <Grid item xs={12}>
              <Divider className={classes.divider} />
              <Typography variant="subtitle1" gutterBottom>
                Identity Protection PIN (IP PIN)
                <Tooltip title="The IRS issues IP PINs to victims of identity theft or those who opt-in for extra protection">
                  <IconButton size="small">
                    <InfoOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={primaryHasIPPIN}
                    onChange={(e) => {
                      setPrimaryHasIPPIN(e.target.checked)
                      if (!e.target.checked) {
                        setValue('primaryIPPIN', '')
                      }
                    }}
                    color="primary"
                  />
                }
                label="I have an IRS-issued IP PIN"
              />
            </Grid>

            <Collapse in={primaryHasIPPIN} style={{ width: '100%' }}>
              <Grid item xs={12} sm={6} style={{ paddingLeft: 24, paddingRight: 24 }}>
                <LabeledInput
                  label="Your IP PIN (6 digits)"
                  name="primaryIPPIN"
                  patternConfig={{
                    inputType: 'numeric',
                    regexp: /^\d{6}$/,
                    description: 'IP PIN must be 6 digits',
                    format: '######'
                  }}
                />
                <Typography variant="caption" color="textSecondary">
                  The IP PIN was mailed to you by the IRS or obtained from your IRS online account.
                </Typography>
              </Grid>
            </Collapse>
          </Grid>
        </Paper>

        {/* Spouse Section (for joint returns) */}
        {isJoint && spouseName && (
          <Paper className={classes.paper} elevation={2}>
            <Typography variant="h6" className={classes.sectionTitle}>
              Identity Verification for {spouseName}
            </Typography>

            <Grid container spacing={3}>
              {/* Spouse Prior Year AGI or PIN */}
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={useSpousePriorPIN}
                      onChange={(e) => {
                        setUseSpousePriorPIN(e.target.checked)
                        if (e.target.checked) {
                          setValue('spousePriorYearAGI', '')
                        } else {
                          setValue('spousePriorYearPIN', '')
                        }
                      }}
                      color="primary"
                    />
                  }
                  label={`Use ${priorTaxYear} Self-Select PIN instead of AGI`}
                />
              </Grid>

              <Collapse in={!useSpousePriorPIN} style={{ width: '100%' }}>
                <Grid item xs={12} sm={6} style={{ paddingLeft: 24, paddingRight: 24 }}>
                  <LabeledInput
                    label={`Spouse's ${priorTaxYear} AGI`}
                    name="spousePriorYearAGI"
                    patternConfig={Patterns.currency}
                  />
                </Grid>
              </Collapse>

              <Collapse in={useSpousePriorPIN} style={{ width: '100%' }}>
                <Grid item xs={12} sm={6} style={{ paddingLeft: 24, paddingRight: 24 }}>
                  <LabeledInput
                    label={`Spouse's ${priorTaxYear} Self-Select PIN`}
                    name="spousePriorYearPIN"
                    patternConfig={{
                      inputType: 'numeric',
                      regexp: /^\d{5}$/,
                      description: 'PIN must be 5 digits',
                      format: '#####'
                    }}
                  />
                </Grid>
              </Collapse>

              {/* Spouse IP PIN */}
              <Grid item xs={12}>
                <Divider className={classes.divider} />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={spouseHasIPPIN}
                      onChange={(e) => {
                        setSpouseHasIPPIN(e.target.checked)
                        if (!e.target.checked) {
                          setValue('spouseIPPIN', '')
                        }
                      }}
                      color="primary"
                    />
                  }
                  label="Spouse has an IRS-issued IP PIN"
                />
              </Grid>

              <Collapse in={spouseHasIPPIN} style={{ width: '100%' }}>
                <Grid item xs={12} sm={6} style={{ paddingLeft: 24, paddingRight: 24 }}>
                  <LabeledInput
                    label="Spouse's IP PIN (6 digits)"
                    name="spouseIPPIN"
                    patternConfig={{
                      inputType: 'numeric',
                      regexp: /^\d{6}$/,
                      description: 'IP PIN must be 6 digits',
                      format: '######'
                    }}
                  />
                </Grid>
              </Collapse>
            </Grid>
          </Paper>
        )}

        {/* Help Information */}
        <Alert severity="info" className={classes.alert}>
          <Typography variant="body2">
            <strong>Can&apos;t find your prior year AGI?</strong>
            <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
              <li>Check your {priorTaxYear} Form 1040, Line 11</li>
              <li>Request a transcript from the IRS at{' '}
                <Link
                  href="https://www.irs.gov/individuals/get-transcript"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={classes.link}
                >
                  irs.gov/get-transcript
                </Link>
              </li>
              <li>If you didn&apos;t file last year, enter $0</li>
              <li>If you filed late last year, the IRS may not have processed it yet - try $0</li>
            </ul>
          </Typography>
        </Alert>
      </form>
    </FormProvider>
  )
}

export default IdentityVerification
