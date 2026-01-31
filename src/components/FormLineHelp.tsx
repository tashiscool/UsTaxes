/**
 * FormLineHelp Component
 *
 * Displays an AI-powered help tooltip for tax form line items.
 * Shows IRC section citations and plain-English explanations.
 */

import React, { useState, ReactElement } from 'react'
import {
  IconButton,
  Popover,
  Typography,
  Box,
  CircularProgress,
  Link,
  Chip,
  Divider,
  makeStyles,
  createStyles,
  Theme,
  Collapse
} from '@material-ui/core'
import HelpOutlineIcon from '@material-ui/icons/HelpOutline'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import ExpandLessIcon from '@material-ui/icons/ExpandLess'
import { useLazyTaxExplanation, TaxContext } from 'ustaxes/lib/tax-explainer'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    helpButton: {
      padding: theme.spacing(0.5),
      marginLeft: theme.spacing(0.5),
      color: theme.palette.info.main,
      '&:hover': {
        backgroundColor: theme.palette.info.light + '20'
      }
    },
    popover: {
      maxWidth: 450,
      padding: theme.spacing(2)
    },
    loading: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 100,
      minWidth: 200
    },
    summary: {
      fontWeight: 600,
      marginBottom: theme.spacing(1),
      color: theme.palette.text.primary
    },
    explanation: {
      marginBottom: theme.spacing(2),
      lineHeight: 1.6,
      color: theme.palette.text.secondary
    },
    sectionHeader: {
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(0.5)
    },
    sectionTitle: {
      fontWeight: 500,
      fontSize: '0.875rem',
      color: theme.palette.text.primary
    },
    citation: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: theme.spacing(0.5)
    },
    citationChip: {
      marginRight: theme.spacing(1),
      backgroundColor: theme.palette.primary.light,
      color: theme.palette.primary.contrastText
    },
    citationTitle: {
      fontSize: '0.8rem',
      color: theme.palette.text.secondary
    },
    excerpt: {
      fontStyle: 'italic',
      fontSize: '0.8rem',
      color: theme.palette.text.secondary,
      marginTop: theme.spacing(0.5),
      marginLeft: theme.spacing(2),
      paddingLeft: theme.spacing(1),
      borderLeft: `2px solid ${theme.palette.divider}`
    },
    regulationsList: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5),
      marginTop: theme.spacing(0.5)
    },
    regChip: {
      fontSize: '0.7rem'
    },
    errorText: {
      color: theme.palette.error.main,
      textAlign: 'center',
      padding: theme.spacing(2)
    },
    disclaimer: {
      fontSize: '0.7rem',
      color: theme.palette.text.disabled,
      marginTop: theme.spacing(2),
      fontStyle: 'italic'
    }
  })
)

interface FormLineHelpProps {
  formId: string
  lineNumber: string
  context?: TaxContext
  size?: 'small' | 'medium'
}

export function FormLineHelp({
  formId,
  lineNumber,
  context,
  size = 'small'
}: FormLineHelpProps): ReactElement {
  const classes = useStyles()
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const [showLegalBasis, setShowLegalBasis] = useState(false)
  const { explanation, loading, error, fetchExplanation } =
    useLazyTaxExplanation()

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
    if (!explanation) {
      await fetchExplanation(formId, lineNumber, context, 'standard')
    }
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const open = Boolean(anchorEl)

  return (
    <>
      <IconButton
        className={classes.helpButton}
        onClick={handleClick}
        size={size}
        aria-label={`Help for ${formId} line ${lineNumber}`}
      >
        <HelpOutlineIcon fontSize={size} />
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left'
        }}
      >
        <Box className={classes.popover}>
          {loading && (
            <Box className={classes.loading}>
              <CircularProgress size={24} />
            </Box>
          )}

          {error && (
            <Typography className={classes.errorText}>
              Unable to load help. Please try again.
            </Typography>
          )}

          {explanation && !loading && (
            <>
              {/* Summary */}
              <Typography variant="body1" className={classes.summary}>
                {explanation.explanation.summary}
              </Typography>

              {/* Plain English Explanation */}
              <Typography variant="body2" className={classes.explanation}>
                {explanation.explanation.plainEnglish}
              </Typography>

              {/* Calculation Notes */}
              {explanation.explanation.calculationNotes && (
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  <strong>Note:</strong>{' '}
                  {explanation.explanation.calculationNotes}
                </Typography>
              )}

              <Divider />

              {/* Legal Basis Section (Collapsible) */}
              <Box
                className={classes.sectionHeader}
                onClick={() => setShowLegalBasis(!showLegalBasis)}
              >
                <Typography className={classes.sectionTitle}>
                  Legal Basis
                </Typography>
                {showLegalBasis ? (
                  <ExpandLessIcon fontSize="small" />
                ) : (
                  <ExpandMoreIcon fontSize="small" />
                )}
              </Box>

              <Collapse in={showLegalBasis}>
                {/* Primary IRC Section */}
                {explanation.legalBasis.primaryIrcSection && (
                  <Box className={classes.citation}>
                    <Chip
                      label={`IRC § ${explanation.legalBasis.primaryIrcSection.section}`}
                      size="small"
                      className={classes.citationChip}
                    />
                    <Typography className={classes.citationTitle}>
                      {explanation.legalBasis.primaryIrcSection.title}
                    </Typography>
                  </Box>
                )}

                {/* Excerpt */}
                {explanation.legalBasis.primaryIrcSection?.excerpt && (
                  <Typography className={classes.excerpt}>
                    "{explanation.legalBasis.primaryIrcSection.excerpt}"
                  </Typography>
                )}

                {/* Related Sections */}
                {explanation.legalBasis.relatedSections.length > 0 && (
                  <Box mt={1}>
                    <Typography variant="caption" color="textSecondary">
                      Related Sections:
                    </Typography>
                    <Box className={classes.regulationsList}>
                      {explanation.legalBasis.relatedSections.map((sec, i) => (
                        <Chip
                          key={i}
                          label={`§ ${sec.section}`}
                          size="small"
                          variant="outlined"
                          className={classes.regChip}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Treasury Regulations */}
                {explanation.legalBasis.treasuryRegulations.length > 0 && (
                  <Box mt={1}>
                    <Typography variant="caption" color="textSecondary">
                      Treasury Regulations:
                    </Typography>
                    <Box className={classes.regulationsList}>
                      {explanation.legalBasis.treasuryRegulations.map(
                        (reg, i) => (
                          <Chip
                            key={i}
                            label={`Reg. ${reg.regulation}`}
                            size="small"
                            variant="outlined"
                            className={classes.regChip}
                          />
                        )
                      )}
                    </Box>
                  </Box>
                )}

                {/* IRS Publications */}
                {explanation.legalBasis.irsPublications.length > 0 && (
                  <Box mt={1}>
                    <Typography variant="caption" color="textSecondary">
                      IRS Publications:
                    </Typography>
                    <Box className={classes.regulationsList}>
                      {explanation.legalBasis.irsPublications.map((pub, i) => (
                        <Link
                          key={i}
                          href={`https://www.irs.gov/pub/irs-pdf/p${pub.number}.pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Chip
                            label={`Pub ${pub.number}`}
                            size="small"
                            variant="outlined"
                            clickable
                            className={classes.regChip}
                          />
                        </Link>
                      ))}
                    </Box>
                  </Box>
                )}
              </Collapse>

              {/* Disclaimer */}
              <Typography className={classes.disclaimer}>
                This explanation is for educational purposes only and does not
                constitute tax advice. Consult a tax professional for specific
                guidance.
              </Typography>
            </>
          )}
        </Box>
      </Popover>
    </>
  )
}

export default FormLineHelp
