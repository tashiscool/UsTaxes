/**
 * E-File Status Component
 *
 * Displays the current status of an e-filed tax return submission.
 * Shows acceptance confirmation, rejection errors with resolutions,
 * and provides links for next steps.
 */

import { ReactElement } from 'react'
import {
  Grid,
  Typography,
  Paper,
  Box,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  LinearProgress,
  Divider,
  Link,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@material-ui/core'
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles'
import CheckCircleIcon from '@material-ui/icons/CheckCircle'
import ErrorIcon from '@material-ui/icons/Error'
import WarningIcon from '@material-ui/icons/Warning'
import HourglassEmptyIcon from '@material-ui/icons/HourglassEmpty'
import PrintIcon from '@material-ui/icons/Print'
import RefreshIcon from '@material-ui/icons/Refresh'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import ReceiptIcon from '@material-ui/icons/Receipt'
import AccountBalanceIcon from '@material-ui/icons/AccountBalance'
import DateRangeIcon from '@material-ui/icons/DateRange'

import { AckStatus, AckError, Acknowledgment } from '../../efile/types/mefTypes'

// =============================================================================
// Styles
// =============================================================================

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    paper: {
      padding: theme.spacing(3),
      marginBottom: theme.spacing(2)
    },
    statusHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
      marginBottom: theme.spacing(3)
    },
    statusIcon: {
      fontSize: 48
    },
    acceptedIcon: {
      color: theme.palette.success.main
    },
    rejectedIcon: {
      color: theme.palette.error.main
    },
    pendingIcon: {
      color: theme.palette.warning.main
    },
    statusChip: {
      marginLeft: theme.spacing(1)
    },
    detailsGrid: {
      marginTop: theme.spacing(2)
    },
    detailItem: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(1)
    },
    detailIcon: {
      color: theme.palette.text.secondary
    },
    errorAccordion: {
      marginBottom: theme.spacing(1),
      '&:before': {
        display: 'none'
      }
    },
    errorSummary: {
      backgroundColor: theme.palette.error.light + '20'
    },
    errorDetails: {
      backgroundColor:
        theme.palette.type === 'dark'
          ? 'rgba(255, 255, 255, 0.02)'
          : 'rgba(0, 0, 0, 0.01)'
    },
    resolutionBox: {
      backgroundColor: theme.palette.info.light + '20',
      padding: theme.spacing(2),
      borderRadius: theme.shape.borderRadius,
      marginTop: theme.spacing(1)
    },
    actionButtons: {
      display: 'flex',
      gap: theme.spacing(2),
      marginTop: theme.spacing(3)
    },
    progressBar: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2)
    },
    refundInfo: {
      backgroundColor: theme.palette.success.light + '20',
      padding: theme.spacing(2),
      borderRadius: theme.shape.borderRadius,
      border: `1px solid ${theme.palette.success.main}`,
      marginTop: theme.spacing(2)
    },
    balanceDueInfo: {
      backgroundColor: theme.palette.warning.light + '20',
      padding: theme.spacing(2),
      borderRadius: theme.shape.borderRadius,
      border: `1px solid ${theme.palette.warning.main}`,
      marginTop: theme.spacing(2)
    },
    divider: {
      margin: theme.spacing(3, 0)
    },
    timestamp: {
      fontFamily: 'monospace',
      fontSize: '0.875rem',
      color: theme.palette.text.secondary
    }
  })
)

// =============================================================================
// Types
// =============================================================================

export interface EFileStatusProps {
  /** Submission ID */
  submissionId?: string
  /** Current status */
  status: AckStatus | 'submitting' | 'pending'
  /** Full acknowledgment (if received) */
  acknowledgment?: Acknowledgment
  /** Tax year */
  taxYear: string
  /** Primary taxpayer name */
  primaryName: string
  /** Refund amount (if applicable) */
  refundAmount?: number
  /** Amount owed (if applicable) */
  amountOwed?: number
  /** Electronic postmark date */
  electronicPostmark?: Date
  /** Whether still polling for acknowledgment */
  isPolling?: boolean
  /** Polling progress (0-100) */
  pollingProgress?: number
  /** Called to retry polling */
  onRetryPolling?: () => void
  /** Called to print for mail filing */
  onPrintForMail?: () => void
  /** Called to fix errors and resubmit */
  onFixAndResubmit?: () => void
}

// =============================================================================
// Error Resolutions
// =============================================================================

interface ErrorResolution {
  pattern: RegExp
  resolution: string
  action?: string
  link?: string
}

const ERROR_RESOLUTIONS: ErrorResolution[] = [
  {
    pattern: /SSN.*dependent.*another return/i,
    resolution:
      'Someone else claimed your dependent. You may need to file by mail with documentation proving the dependent is yours.',
    action: 'Print and mail your return'
  },
  {
    pattern: /SSN.*already.*filed/i,
    resolution:
      'A return has already been filed with this SSN. This could indicate identity theft. File Form 14039 (Identity Theft Affidavit).',
    action: 'File Form 14039',
    link: 'https://www.irs.gov/individuals/how-irs-id-theft-victim-assistance-works'
  },
  {
    pattern: /AGI.*does not match/i,
    resolution:
      'The prior year AGI you entered does not match IRS records. Try entering $0 if you filed late last year, or check your prior year return.',
    action: 'Update prior year AGI'
  },
  {
    pattern: /IP PIN.*invalid/i,
    resolution:
      'The Identity Protection PIN is incorrect. You can retrieve your IP PIN from your IRS online account.',
    action: 'Get IP PIN',
    link: 'https://www.irs.gov/identity-theft-fraud-scams/get-an-identity-protection-pin'
  },
  {
    pattern: /EIN.*not valid/i,
    resolution:
      'An Employer Identification Number (EIN) on your return is not valid. Please verify the EIN from your W-2 or other tax documents.',
    action: 'Verify employer information'
  },
  {
    pattern: /date of birth/i,
    resolution:
      'A date of birth on your return does not match IRS records. Verify all dates of birth are correct.',
    action: 'Verify dates of birth'
  },
  {
    pattern: /schema|xml|format/i,
    resolution:
      'There was a technical error with your return format. Please try submitting again.',
    action: 'Resubmit return'
  }
]

/**
 * Find resolution for an error message
 */
function findResolution(errorMessage: string): ErrorResolution | undefined {
  return ERROR_RESOLUTIONS.find((r) => r.pattern.test(errorMessage))
}

// =============================================================================
// Component
// =============================================================================

export function EFileStatus({
  submissionId,
  status,
  acknowledgment,
  taxYear,
  primaryName,
  refundAmount,
  amountOwed,
  electronicPostmark,
  isPolling,
  pollingProgress,
  onRetryPolling,
  onPrintForMail,
  onFixAndResubmit
}: EFileStatusProps): ReactElement {
  const classes = useStyles()

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  // Format date
  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Render status icon
  const renderStatusIcon = () => {
    switch (status) {
      case 'Accepted':
        return (
          <CheckCircleIcon
            className={`${classes.statusIcon} ${classes.acceptedIcon}`}
          />
        )
      case 'Rejected':
        return (
          <ErrorIcon
            className={`${classes.statusIcon} ${classes.rejectedIcon}`}
          />
        )
      case 'pending':
      case 'Pending':
      case 'submitting':
        return (
          <HourglassEmptyIcon
            className={`${classes.statusIcon} ${classes.pendingIcon}`}
          />
        )
      default:
        return (
          <HourglassEmptyIcon
            className={`${classes.statusIcon} ${classes.pendingIcon}`}
          />
        )
    }
  }

  // Render status chip
  const renderStatusChip = () => {
    switch (status) {
      case 'Accepted':
        return (
          <Chip
            label="Accepted"
            color="primary"
            className={classes.statusChip}
          />
        )
      case 'Rejected':
        return (
          <Chip
            label="Rejected"
            color="secondary"
            className={classes.statusChip}
          />
        )
      case 'pending':
      case 'Pending':
        return <Chip label="Pending" className={classes.statusChip} />
      case 'submitting':
        return <Chip label="Submitting..." className={classes.statusChip} />
      default:
        return null
    }
  }

  return (
    <>
      {/* Status Header */}
      <Paper className={classes.paper} elevation={2}>
        <Box className={classes.statusHeader}>
          {renderStatusIcon()}
          <Box>
            <Typography variant="h5">
              {status === 'Accepted' && 'Your Return Has Been Accepted!'}
              {status === 'Rejected' && 'Your Return Has Been Rejected'}
              {(status === 'pending' || status === 'Pending') &&
                'Waiting for IRS Response'}
              {status === 'submitting' && 'Submitting Your Return...'}
              {renderStatusChip()}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Tax Year {taxYear} - {primaryName}
            </Typography>
          </Box>
        </Box>

        {/* Polling Progress */}
        {isPolling && (
          <Box className={classes.progressBar}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Checking for IRS acknowledgment...
            </Typography>
            <LinearProgress
              variant={
                pollingProgress !== undefined ? 'determinate' : 'indeterminate'
              }
              value={pollingProgress}
            />
          </Box>
        )}

        {/* Submission Details */}
        <Grid container spacing={2} className={classes.detailsGrid}>
          {submissionId && (
            <Grid item xs={12} sm={6}>
              <Box className={classes.detailItem}>
                <ReceiptIcon className={classes.detailIcon} />
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Submission ID
                  </Typography>
                  <Typography variant="body2" className={classes.timestamp}>
                    {submissionId}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          )}

          {electronicPostmark && (
            <Grid item xs={12} sm={6}>
              <Box className={classes.detailItem}>
                <DateRangeIcon className={classes.detailIcon} />
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Electronic Postmark
                  </Typography>
                  <Typography variant="body2" className={classes.timestamp}>
                    {formatDate(electronicPostmark)}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          )}

          {acknowledgment?.irsReceiptId && (
            <Grid item xs={12} sm={6}>
              <Box className={classes.detailItem}>
                <ReceiptIcon className={classes.detailIcon} />
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    IRS Receipt ID
                  </Typography>
                  <Typography variant="body2" className={classes.timestamp}>
                    {acknowledgment.irsReceiptId}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          )}

          {acknowledgment?.ackTs && (
            <Grid item xs={12} sm={6}>
              <Box className={classes.detailItem}>
                <DateRangeIcon className={classes.detailIcon} />
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    IRS Response Time
                  </Typography>
                  <Typography variant="body2" className={classes.timestamp}>
                    {formatDate(acknowledgment.ackTs)}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Accepted: Refund/Payment Info */}
      {status === 'Accepted' && (
        <Paper className={classes.paper} elevation={2}>
          <Typography variant="h6" gutterBottom>
            Next Steps
          </Typography>

          {refundAmount && refundAmount > 0 && (
            <Box className={classes.refundInfo}>
              <Box className={classes.detailItem}>
                <AccountBalanceIcon color="primary" />
                <Box>
                  <Typography variant="h5" color="primary">
                    Refund: {formatCurrency(refundAmount)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Direct deposit typically arrives within 21 days
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}

          {amountOwed && amountOwed > 0 && (
            <Box className={classes.balanceDueInfo}>
              <Box className={classes.detailItem}>
                <AccountBalanceIcon color="error" />
                <Box>
                  <Typography variant="h5" color="error">
                    Balance Due: {formatCurrency(amountOwed)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Payment is due by April 15, {parseInt(taxYear) + 1}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}

          <Divider className={classes.divider} />

          <Typography variant="subtitle2" gutterBottom>
            What to do now:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Save your confirmation"
                secondary="Print or save this page for your records"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Track your refund"
                secondary={
                  <>
                    Use{' '}
                    <Link
                      href="https://www.irs.gov/refunds"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Where&apos;s My Refund?
                    </Link>{' '}
                    after 24 hours
                  </>
                }
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Keep your records"
                secondary="Store your tax documents for at least 3 years"
              />
            </ListItem>
          </List>
        </Paper>
      )}

      {/* Rejected: Error Details */}
      {status === 'Rejected' && acknowledgment?.errors && (
        <Paper className={classes.paper} elevation={2}>
          <Typography variant="h6" gutterBottom color="error">
            Rejection Errors
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Your return was rejected due to the following issues. Please review
            and correct them.
          </Typography>

          {acknowledgment.errors.map((error, index) => {
            const resolution = findResolution(error.errorMessageTxt)

            return (
              <Accordion
                key={error.errorId || index}
                className={classes.errorAccordion}
                defaultExpanded={index === 0}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  className={classes.errorSummary}
                >
                  <Box>
                    <Typography variant="subtitle2">
                      Error {error.ruleNum || error.errorId}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {error.errorMessageTxt}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails className={classes.errorDetails}>
                  <Box style={{ width: '100%' }}>
                    {error.fieldNm && (
                      <Typography variant="body2" gutterBottom>
                        <strong>Field:</strong> {error.fieldNm}
                      </Typography>
                    )}
                    {error.fieldValueTxt && (
                      <Typography variant="body2" gutterBottom>
                        <strong>Value:</strong> {error.fieldValueTxt}
                      </Typography>
                    )}

                    {resolution && (
                      <Box className={classes.resolutionBox}>
                        <Typography variant="subtitle2" gutterBottom>
                          How to fix this:
                        </Typography>
                        <Typography variant="body2" paragraph>
                          {resolution.resolution}
                        </Typography>
                        {resolution.link && (
                          <Link
                            href={resolution.link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Learn more
                          </Link>
                        )}
                      </Box>
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>
            )
          })}

          {/* Action Buttons */}
          <Box className={classes.actionButtons}>
            {onFixAndResubmit && (
              <Button
                variant="contained"
                color="primary"
                onClick={onFixAndResubmit}
              >
                Fix Errors and Resubmit
              </Button>
            )}
            {onPrintForMail && (
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={onPrintForMail}
              >
                Print for Mail Filing
              </Button>
            )}
          </Box>
        </Paper>
      )}

      {/* Pending: Retry Options */}
      {(status === 'pending' || status === 'Pending') && !isPolling && (
        <Paper className={classes.paper} elevation={2}>
          <Typography variant="h6" gutterBottom>
            Still Waiting?
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            The IRS typically responds within a few minutes to 48 hours. If
            you&apos;ve been waiting more than 48 hours, there may be an issue.
          </Typography>

          <Box className={classes.actionButtons}>
            {onRetryPolling && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<RefreshIcon />}
                onClick={onRetryPolling}
              >
                Check Status Again
              </Button>
            )}
            {onPrintForMail && (
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={onPrintForMail}
              >
                Print for Mail Filing
              </Button>
            )}
          </Box>
        </Paper>
      )}
    </>
  )
}

export default EFileStatus
