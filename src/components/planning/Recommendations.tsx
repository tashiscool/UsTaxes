import { ReactElement, useMemo } from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  makeStyles,
  createStyles,
  Theme
} from '@material-ui/core'
import {
  TrendingDown,
  AccountBalance,
  LocalHospital,
  AttachMoney,
  Warning,
  CheckCircle,
  Info,
  EmojiObjects,
  ArrowForward
} from '@material-ui/icons'
import Alert from '@material-ui/lab/Alert'
import {
  TaxInputs,
  TaxBreakdown,
  calculateTaxSavingOpportunities,
  getIRAContributionLimit,
  getHSAContributionLimit,
  calculateChildTaxCredit,
  calculateEarnedIncomeCredit
} from 'ustaxes/core/planning/taxCalculator'
import { Currency } from 'ustaxes/components/input'
import { FilingStatus } from 'ustaxes/core/data'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    paper: {
      padding: theme.spacing(3),
      marginBottom: theme.spacing(2)
    },
    recommendationCard: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    },
    savingsChip: {
      backgroundColor: theme.palette.success.light,
      color: theme.palette.success.contrastText,
      fontWeight: 'bold'
    },
    warningChip: {
      backgroundColor: theme.palette.warning.light,
      color: theme.palette.warning.contrastText
    },
    infoChip: {
      backgroundColor: theme.palette.info.light,
      color: theme.palette.info.contrastText
    },
    cardContent: {
      flexGrow: 1
    },
    icon: {
      marginRight: theme.spacing(1)
    },
    highPriority: {
      borderLeft: `4px solid ${theme.palette.success.main}`
    },
    mediumPriority: {
      borderLeft: `4px solid ${theme.palette.warning.main}`
    },
    lowPriority: {
      borderLeft: `4px solid ${theme.palette.info.main}`
    },
    summaryCard: {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
      marginBottom: theme.spacing(3)
    },
    creditEligibility: {
      marginTop: theme.spacing(2)
    },
    eligible: {
      color: theme.palette.success.main
    },
    notEligible: {
      color: theme.palette.text.disabled
    }
  })
)

interface RecommendationsProps {
  inputs: TaxInputs
  breakdown: TaxBreakdown
}

interface CreditEligibility {
  name: string
  eligible: boolean
  currentAmount: number
  maxAmount: number
  reason?: string
}

function getStrategyIcon(strategy: string): ReactElement {
  if (strategy.toLowerCase().includes('ira')) {
    return <AccountBalance />
  }
  if (strategy.toLowerCase().includes('hsa')) {
    return <LocalHospital />
  }
  if (
    strategy.toLowerCase().includes('withholding') ||
    strategy.toLowerCase().includes('w-4')
  ) {
    return <AttachMoney />
  }
  if (strategy.toLowerCase().includes('harvest')) {
    return <TrendingDown />
  }
  return <EmojiObjects />
}

function getPriorityClass(
  savings: number,
  classes: ReturnType<typeof useStyles>
): string {
  if (savings >= 1000) return classes.highPriority
  if (savings >= 500) return classes.mediumPriority
  return classes.lowPriority
}

export default function Recommendations({
  inputs,
  breakdown
}: RecommendationsProps): ReactElement {
  const classes = useStyles()

  // Calculate tax saving opportunities
  const opportunities = useMemo(() => {
    return calculateTaxSavingOpportunities(inputs, breakdown)
  }, [inputs, breakdown])

  // Calculate total potential savings
  const totalPotentialSavings = useMemo(() => {
    return opportunities.reduce((sum, opp) => sum + opp.potentialSavings, 0)
  }, [opportunities])

  // Check credit eligibility
  const creditEligibility = useMemo((): CreditEligibility[] => {
    const credits: CreditEligibility[] = []

    // Child Tax Credit
    const ctcMax = inputs.dependents * 2000
    const ctcActual = calculateChildTaxCredit(
      breakdown.adjustedGrossIncome,
      inputs.filingStatus,
      inputs.dependents,
      inputs.year
    )
    if (inputs.dependents > 0) {
      credits.push({
        name: 'Child Tax Credit',
        eligible: ctcActual > 0,
        currentAmount: inputs.credits.childTaxCredit,
        maxAmount: ctcMax,
        reason:
          ctcActual < ctcMax
            ? `Phase-out begins at $${
                inputs.filingStatus === FilingStatus.MFJ ? '400,000' : '200,000'
              } AGI`
            : undefined
      })
    }

    // Earned Income Credit
    const eicActual = calculateEarnedIncomeCredit(
      inputs.wages,
      breakdown.adjustedGrossIncome,
      inputs.filingStatus,
      Math.min(inputs.dependents, 3)
    )
    if (inputs.filingStatus !== FilingStatus.MFS) {
      const eicMaxAmounts = [600, 3995, 6604, 7430]
      const eicMax = eicMaxAmounts[Math.min(inputs.dependents, 3)]
      credits.push({
        name: 'Earned Income Credit',
        eligible: eicActual > 0,
        currentAmount: inputs.credits.earnedIncomeCredit,
        maxAmount: eicMax,
        reason:
          eicActual === 0
            ? 'Income may be too high or filing status not eligible'
            : undefined
      })
    } else {
      credits.push({
        name: 'Earned Income Credit',
        eligible: false,
        currentAmount: 0,
        maxAmount: 0,
        reason: 'Married Filing Separately is not eligible for EIC'
      })
    }

    // Education Credits (simplified)
    credits.push({
      name: 'American Opportunity Credit',
      eligible: breakdown.adjustedGrossIncome < 180000,
      currentAmount: inputs.credits.educationCredits,
      maxAmount: 2500,
      reason:
        breakdown.adjustedGrossIncome >= 180000
          ? 'Phase-out complete at $180,000 AGI (MFJ)'
          : undefined
    })

    // Saver's Credit
    const saversIncomeLimit =
      inputs.filingStatus === FilingStatus.MFJ
        ? 76500
        : inputs.filingStatus === FilingStatus.HOH
        ? 57375
        : 38250
    credits.push({
      name: "Saver's Credit",
      eligible: breakdown.adjustedGrossIncome <= saversIncomeLimit,
      currentAmount: 0,
      maxAmount:
        inputs.filingStatus === FilingStatus.MFJ ||
        inputs.filingStatus === FilingStatus.W
          ? 2000
          : 1000,
      reason:
        breakdown.adjustedGrossIncome > saversIncomeLimit
          ? `AGI exceeds $${saversIncomeLimit.toLocaleString()} limit`
          : 'Available for retirement contributions'
    })

    return credits
  }, [inputs, breakdown])

  // Generate additional smart suggestions
  const smartSuggestions = useMemo(() => {
    const suggestions: string[] = []

    // Check if close to next tax bracket
    const bracketBreakdown = breakdown.bracketBreakdown
    if (bracketBreakdown.length > 0) {
      const currentBracket = bracketBreakdown[bracketBreakdown.length - 1]
      if (currentBracket.rate >= 22 && breakdown.adjustedGrossIncome > 50000) {
        suggestions.push(
          `You're in the ${
            currentBracket.rate
          }% tax bracket. Each additional dollar of pre-tax contributions saves you $${(
            currentBracket.rate / 100
          ).toFixed(2)} in taxes.`
        )
      }
    }

    // Large refund warning
    if (breakdown.refundOrOwed > 3000) {
      suggestions.push(
        `You're getting a large refund of $${breakdown.refundOrOwed.toLocaleString()}. Consider adjusting your W-4 to keep more money in your paycheck throughout the year.`
      )
    }

    // Amount owed warning
    if (breakdown.refundOrOwed < -1000) {
      suggestions.push(
        `You'll owe $${Math.abs(
          breakdown.refundOrOwed
        ).toLocaleString()} at tax time. Make sure to set aside funds or increase withholding to avoid surprises.`
      )
    }

    // Capital gains timing
    if (inputs.longTermCapitalGains > 0 || inputs.shortTermCapitalGains > 0) {
      if (inputs.shortTermCapitalGains > inputs.longTermCapitalGains * 0.5) {
        suggestions.push(
          'Consider holding investments longer than one year to qualify for lower long-term capital gains rates (0%, 15%, or 20% vs. ordinary income rates).'
        )
      }
    }

    // Retirement contribution maximization
    const iraLimit = getIRAContributionLimit(inputs.year, 50)
    const hsaLimit = getHSAContributionLimit(inputs.year, 'family', 55)
    const totalRetirementSpace =
      iraLimit -
      inputs.adjustments.iraContribution +
      (hsaLimit - inputs.adjustments.hsaContribution)

    if (totalRetirementSpace > 5000 && breakdown.marginalTaxRate >= 22) {
      suggestions.push(
        `You have $${totalRetirementSpace.toLocaleString()} in unused tax-advantaged contribution space (IRA + HSA). At your ${
          breakdown.marginalTaxRate
        }% marginal rate, maxing out could save over $${Math.round(
          (totalRetirementSpace * breakdown.marginalTaxRate) / 100
        ).toLocaleString()} in taxes.`
      )
    }

    return suggestions
  }, [inputs, breakdown])

  return (
    <Box>
      {/* Summary Card */}
      <Card className={classes.summaryCard}>
        <CardContent>
          <Grid container alignItems="center" spacing={2}>
            <Grid item>
              <EmojiObjects style={{ fontSize: 48 }} />
            </Grid>
            <Grid item xs>
              <Typography variant="h6">
                Total Potential Tax Savings Identified
              </Typography>
              <Typography variant="h3">
                <Currency value={totalPotentialSavings} plain />
              </Typography>
              <Typography variant="body2" style={{ opacity: 0.9 }}>
                {opportunities.length} optimization opportunities found
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Main Recommendations */}
      <Paper className={classes.paper}>
        <Typography variant="h6" gutterBottom>
          Tax Saving Recommendations
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Based on your current tax situation, here are personalized
          recommendations to reduce your tax liability
        </Typography>

        <Grid container spacing={3}>
          {opportunities.map((opportunity, index) => (
            <Grid item xs={12} md={6} key={index}>
              <Card
                className={`${classes.recommendationCard} ${getPriorityClass(
                  opportunity.potentialSavings,
                  classes
                )}`}
              >
                <CardContent className={classes.cardContent}>
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={1}
                  >
                    <Box display="flex" alignItems="center">
                      {getStrategyIcon(opportunity.strategy)}
                      <Typography variant="subtitle1" style={{ marginLeft: 8 }}>
                        {opportunity.strategy}
                      </Typography>
                    </Box>
                    <Chip
                      label={
                        <>
                          Save{' '}
                          <Currency
                            value={opportunity.potentialSavings}
                            plain
                          />
                        </>
                      }
                      className={classes.savingsChip}
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    {opportunity.description}
                  </Typography>
                  <Alert severity="info" icon={<ArrowForward />}>
                    <Typography variant="body2">
                      {opportunity.requiredAction}
                    </Typography>
                  </Alert>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {opportunities.length === 0 && (
          <Alert severity="success">
            <Typography variant="body2">
              Great job! Your tax situation appears to be well-optimized. No
              major savings opportunities identified at this time.
            </Typography>
          </Alert>
        )}
      </Paper>

      {/* Credit Eligibility */}
      <Paper className={classes.paper}>
        <Typography variant="h6" gutterBottom>
          Tax Credit Eligibility
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Check which tax credits you may qualify for based on your filing
          status and income
        </Typography>

        <List>
          {creditEligibility.map((credit, index) => (
            <div key={credit.name}>
              <ListItem>
                <ListItemIcon>
                  {credit.eligible ? (
                    <CheckCircle className={classes.eligible} />
                  ) : (
                    <Warning className={classes.notEligible} />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography
                        variant="subtitle2"
                        className={
                          credit.eligible
                            ? classes.eligible
                            : classes.notEligible
                        }
                      >
                        {credit.name}
                      </Typography>
                      {credit.eligible && (
                        <Chip
                          label={
                            <>
                              Up to <Currency value={credit.maxAmount} plain />
                            </>
                          }
                          size="small"
                          className={classes.infoChip}
                        />
                      )}
                    </Box>
                  }
                  secondary={credit.reason}
                />
              </ListItem>
              {index < creditEligibility.length - 1 && <Divider />}
            </div>
          ))}
        </List>
      </Paper>

      {/* Smart Suggestions */}
      {smartSuggestions.length > 0 && (
        <Paper className={classes.paper}>
          <Typography variant="h6" gutterBottom>
            <Info
              className={classes.icon}
              style={{ verticalAlign: 'middle' }}
            />
            Smart Insights
          </Typography>

          <List>
            {smartSuggestions.map((suggestion, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  <EmojiObjects color="primary" />
                </ListItemIcon>
                <ListItemText primary={suggestion} />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Contribution Limits Reference */}
      <Paper className={classes.paper}>
        <Typography variant="h6" gutterBottom>
          {inputs.year} Contribution Limits Reference
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">
                  Traditional/Roth IRA
                </Typography>
                <Typography variant="h5">
                  <Currency
                    value={getIRAContributionLimit(inputs.year, 49)}
                    plain
                  />
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  +$1,000 catch-up if 50+
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">
                  401(k) / 403(b)
                </Typography>
                <Typography variant="h5">
                  <Currency value={23000} plain />
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  +$7,500 catch-up if 50+
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">
                  HSA (Self-only)
                </Typography>
                <Typography variant="h5">
                  <Currency
                    value={getHSAContributionLimit(
                      inputs.year,
                      'self-only',
                      54
                    )}
                    plain
                  />
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  +$1,000 catch-up if 55+
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">
                  HSA (Family)
                </Typography>
                <Typography variant="h5">
                  <Currency
                    value={getHSAContributionLimit(inputs.year, 'family', 54)}
                    plain
                  />
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  +$1,000 catch-up if 55+
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}
