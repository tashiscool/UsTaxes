import { ReactElement, useState, useMemo } from 'react'
import {
  Box,
  Grid,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Divider,
  makeStyles,
  createStyles,
  Theme,
  Slider
} from '@material-ui/core'
import {
  TrendingUp,
  DateRange,
  AccountBalanceWallet,
  Info
} from '@material-ui/icons'
import Alert from '@material-ui/lab/Alert'
import {
  TaxInputs,
  TaxBreakdown,
  calculateSafeHarbor,
  projectNextYearTax,
  getFederalTaxData
} from 'ustaxes/core/planning/taxCalculator'
import { Currency } from 'ustaxes/components/input'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    paper: {
      padding: theme.spacing(3),
      marginBottom: theme.spacing(2)
    },
    projectionCard: {
      height: '100%'
    },
    quarterlyCard: {
      backgroundColor: theme.palette.primary.light,
      color: theme.palette.primary.contrastText
    },
    positive: {
      color: theme.palette.success.main
    },
    negative: {
      color: theme.palette.error.main
    },
    neutral: {
      color: theme.palette.text.secondary
    },
    deadlineRow: {
      '&:nth-of-type(odd)': {
        backgroundColor: theme.palette.action.hover
      }
    },
    sliderContainer: {
      padding: theme.spacing(2, 0)
    },
    infoAlert: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2)
    },
    comparisonTable: {
      marginTop: theme.spacing(2)
    },
    bracketBar: {
      height: 20,
      borderRadius: 4,
      marginRight: 8
    },
    bracketLegend: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: theme.spacing(0.5)
    }
  })
)

interface TaxProjectionProps {
  currentInputs: TaxInputs
  currentBreakdown: TaxBreakdown
  priorYearTax?: number
  priorYearAGI?: number
}

const quarterlyDeadlines = [
  { quarter: 'Q1', deadline: 'April 15', period: 'Jan 1 - Mar 31' },
  { quarter: 'Q2', deadline: 'June 15', period: 'Apr 1 - May 31' },
  { quarter: 'Q3', deadline: 'September 15', period: 'Jun 1 - Aug 31' },
  {
    quarter: 'Q4',
    deadline: 'January 15 (next year)',
    period: 'Sep 1 - Dec 31'
  }
]

const bracketColors = [
  '#4caf50', // 10% - green
  '#8bc34a', // 12% - light green
  '#ffeb3b', // 22% - yellow
  '#ffc107', // 24% - amber
  '#ff9800', // 32% - orange
  '#ff5722', // 35% - deep orange
  '#f44336' // 37% - red
]

export default function TaxProjection({
  currentInputs,
  currentBreakdown,
  priorYearTax = currentBreakdown.totalTax * 0.95,
  priorYearAGI = currentBreakdown.adjustedGrossIncome * 0.95
}: TaxProjectionProps): ReactElement {
  const classes = useStyles()
  const [inflationRate, setInflationRate] = useState(2.5)
  const [incomeGrowthRate, setIncomeGrowthRate] = useState(3.0)

  // Project next year's taxes
  const nextYearProjection = useMemo(() => {
    return projectNextYearTax(
      currentInputs,
      inflationRate / 100,
      incomeGrowthRate / 100
    )
  }, [currentInputs, inflationRate, incomeGrowthRate])

  // Calculate safe harbor
  const safeHarbor = useMemo(() => {
    return calculateSafeHarbor(
      priorYearTax,
      priorYearAGI,
      nextYearProjection.projectedBreakdown.totalTax
    )
  }, [priorYearTax, priorYearAGI, nextYearProjection])

  // Get next year's tax data for comparison
  const nextYearTaxData = getFederalTaxData(currentInputs.year + 1)
  const currentYearTaxData = getFederalTaxData(currentInputs.year)

  const taxChange =
    nextYearProjection.projectedBreakdown.totalTax - currentBreakdown.totalTax
  const percentChange =
    currentBreakdown.totalTax > 0
      ? (taxChange / currentBreakdown.totalTax) * 100
      : 0

  return (
    <Box>
      <Paper className={classes.paper}>
        <Typography variant="h6" gutterBottom>
          <TrendingUp style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Next Year Tax Projection
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Estimate your {currentInputs.year + 1} taxes based on projected income
          and inflation-adjusted brackets
        </Typography>

        {/* Assumption Controls */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Box className={classes.sliderContainer}>
              <Typography gutterBottom>
                Assumed Inflation Rate: {inflationRate.toFixed(1)}%
              </Typography>
              <Slider
                value={inflationRate}
                onChange={(_, value) => setInflationRate(value as number)}
                min={0}
                max={10}
                step={0.5}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}%`}
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box className={classes.sliderContainer}>
              <Typography gutterBottom>
                Assumed Income Growth: {incomeGrowthRate.toFixed(1)}%
              </Typography>
              <Slider
                value={incomeGrowthRate}
                onChange={(_, value) => setIncomeGrowthRate(value as number)}
                min={-5}
                max={15}
                step={0.5}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}%`}
              />
            </Box>
          </Grid>
        </Grid>

        <Divider style={{ margin: '16px 0' }} />

        {/* Projection Results */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card className={classes.projectionCard}>
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">
                  Projected {currentInputs.year + 1} Tax
                </Typography>
                <Typography variant="h4">
                  <Currency
                    value={nextYearProjection.projectedBreakdown.totalTax}
                    plain
                  />
                </Typography>
                <Typography
                  variant="body2"
                  className={
                    taxChange > 0
                      ? classes.negative
                      : taxChange < 0
                      ? classes.positive
                      : classes.neutral
                  }
                >
                  {taxChange >= 0 ? '+' : ''}
                  <Currency value={taxChange} plain /> (
                  {percentChange >= 0 ? '+' : ''}
                  {percentChange.toFixed(1)}%)
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card className={classes.projectionCard}>
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">
                  Projected Income
                </Typography>
                <Typography variant="h4">
                  <Currency
                    value={nextYearProjection.projectedBreakdown.grossIncome}
                    plain
                  />
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {incomeGrowthRate >= 0 ? '+' : ''}
                  {incomeGrowthRate}% from current year
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card className={classes.projectionCard}>
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">
                  Projected Effective Rate
                </Typography>
                <Typography variant="h4">
                  {nextYearProjection.projectedBreakdown.effectiveTaxRate.toFixed(
                    1
                  )}
                  %
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Marginal:{' '}
                  {nextYearProjection.projectedBreakdown.marginalTaxRate}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Comparison Table */}
        <TableContainer className={classes.comparisonTable}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell align="right">{currentInputs.year}</TableCell>
                <TableCell align="right">
                  {currentInputs.year + 1} (Projected)
                </TableCell>
                <TableCell align="right">Change</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Gross Income</TableCell>
                <TableCell align="right">
                  <Currency value={currentBreakdown.grossIncome} plain />
                </TableCell>
                <TableCell align="right">
                  <Currency
                    value={nextYearProjection.projectedBreakdown.grossIncome}
                    plain
                  />
                </TableCell>
                <TableCell
                  align="right"
                  className={
                    nextYearProjection.projectedBreakdown.grossIncome >
                    currentBreakdown.grossIncome
                      ? classes.positive
                      : classes.negative
                  }
                >
                  <Currency
                    value={
                      nextYearProjection.projectedBreakdown.grossIncome -
                      currentBreakdown.grossIncome
                    }
                    plain
                  />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Standard Deduction</TableCell>
                <TableCell align="right">
                  <Currency
                    value={
                      currentYearTaxData.standardDeduction[
                        currentInputs.filingStatus
                      ]
                    }
                    plain
                  />
                </TableCell>
                <TableCell align="right">
                  <Currency
                    value={
                      nextYearTaxData.standardDeduction[
                        currentInputs.filingStatus
                      ]
                    }
                    plain
                  />
                </TableCell>
                <TableCell align="right" className={classes.positive}>
                  <Currency
                    value={
                      nextYearTaxData.standardDeduction[
                        currentInputs.filingStatus
                      ] -
                      currentYearTaxData.standardDeduction[
                        currentInputs.filingStatus
                      ]
                    }
                    plain
                  />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Taxable Income</TableCell>
                <TableCell align="right">
                  <Currency value={currentBreakdown.taxableIncome} plain />
                </TableCell>
                <TableCell align="right">
                  <Currency
                    value={nextYearProjection.projectedBreakdown.taxableIncome}
                    plain
                  />
                </TableCell>
                <TableCell
                  align="right"
                  className={
                    nextYearProjection.projectedBreakdown.taxableIncome >
                    currentBreakdown.taxableIncome
                      ? classes.negative
                      : classes.positive
                  }
                >
                  <Currency
                    value={
                      nextYearProjection.projectedBreakdown.taxableIncome -
                      currentBreakdown.taxableIncome
                    }
                    plain
                  />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <strong>Total Tax</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>
                    <Currency value={currentBreakdown.totalTax} plain />
                  </strong>
                </TableCell>
                <TableCell align="right">
                  <strong>
                    <Currency
                      value={nextYearProjection.projectedBreakdown.totalTax}
                      plain
                    />
                  </strong>
                </TableCell>
                <TableCell
                  align="right"
                  className={
                    taxChange > 0 ? classes.negative : classes.positive
                  }
                >
                  <strong>
                    <Currency value={taxChange} plain />
                  </strong>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Quarterly Estimated Tax Calculator */}
      <Paper className={classes.paper}>
        <Typography variant="h6" gutterBottom>
          <DateRange style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Quarterly Estimated Tax Calculator
        </Typography>

        <Alert severity="info" className={classes.infoAlert}>
          <Typography variant="body2">
            <strong>Safe Harbor Rule:</strong> To avoid underpayment penalties,
            you must pay at least the lesser of:
            <ul style={{ marginBottom: 0 }}>
              <li>90% of your current year tax liability, OR</li>
              <li>
                100% of your prior year tax liability (110% if AGI &gt;
                $150,000)
              </li>
            </ul>
          </Typography>
        </Alert>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">
                  Safe Harbor Amount ({currentInputs.year + 1})
                </Typography>
                <Typography variant="h4">
                  <Currency value={safeHarbor.safeHarborAmount} plain />
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Method: {safeHarbor.method}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card className={classes.quarterlyCard}>
              <CardContent>
                <Typography
                  variant="subtitle2"
                  style={{ color: 'rgba(255,255,255,0.8)' }}
                >
                  <AccountBalanceWallet
                    style={{ verticalAlign: 'middle', marginRight: 8 }}
                  />
                  Quarterly Payment
                </Typography>
                <Typography variant="h4">
                  <Currency value={safeHarbor.quarterlyPayment} plain />
                </Typography>
                <Typography
                  variant="body2"
                  style={{ color: 'rgba(255,255,255,0.8)' }}
                >
                  Pay this amount each quarter to meet safe harbor
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Payment Schedule */}
        <Typography variant="subtitle1" style={{ marginTop: 24 }} gutterBottom>
          {currentInputs.year + 1} Payment Schedule
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Quarter</TableCell>
                <TableCell>Income Period</TableCell>
                <TableCell>Payment Deadline</TableCell>
                <TableCell align="right">Amount Due</TableCell>
                <TableCell align="right">Cumulative</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {quarterlyDeadlines.map((q, index) => (
                <TableRow key={q.quarter} className={classes.deadlineRow}>
                  <TableCell>
                    <strong>{q.quarter}</strong>
                  </TableCell>
                  <TableCell>{q.period}</TableCell>
                  <TableCell>{q.deadline}</TableCell>
                  <TableCell align="right">
                    <Currency value={safeHarbor.quarterlyPayment} plain />
                  </TableCell>
                  <TableCell align="right">
                    <Currency
                      value={safeHarbor.quarterlyPayment * (index + 1)}
                      plain
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Bracket Changes Preview */}
        <Box mt={4}>
          <Typography variant="subtitle1" gutterBottom>
            <Info style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Tax Bracket Changes ({currentInputs.year} vs{' '}
            {currentInputs.year + 1})
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Tax brackets are adjusted annually for inflation. Here&apos;s how
            the brackets change:
          </Typography>

          <Grid container spacing={2}>
            {currentYearTaxData.ordinary[currentInputs.filingStatus].rates.map(
              (rate, index) => {
                const currentBracket =
                  currentYearTaxData.ordinary[currentInputs.filingStatus]
                    .brackets[index]
                const nextBracket =
                  nextYearTaxData.ordinary[currentInputs.filingStatus].brackets[
                    index
                  ]
                const bracketChange = nextBracket - currentBracket

                return (
                  <Grid item xs={12} sm={6} md={4} key={rate}>
                    <Box className={classes.bracketLegend}>
                      <Box
                        className={classes.bracketBar}
                        style={{
                          backgroundColor: bracketColors[index],
                          width: 40
                        }}
                      />
                      <Typography variant="body2">
                        <strong>{rate}% bracket</strong>
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary">
                      {currentInputs.year}:{' '}
                      <Currency value={currentBracket} plain /> |{' '}
                      {currentInputs.year + 1}:{' '}
                      <Currency value={nextBracket} plain />
                    </Typography>
                    <Typography variant="caption" className={classes.positive}>
                      +<Currency value={bracketChange} plain /> increase
                    </Typography>
                  </Grid>
                )
              }
            )}
          </Grid>
        </Box>
      </Paper>
    </Box>
  )
}
