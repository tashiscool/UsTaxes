/**
 * ScenarioComparison Component
 *
 * Displays a side-by-side comparison of tax scenarios with:
 * - Tax summaries for each scenario
 * - Highlighted differences from baseline
 * - Visual bar chart representation
 * - Key metrics: AGI, taxable income, total tax, refund/owed
 */

import { ReactElement, useMemo } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Grid,
  LinearProgress,
  Tooltip,
  makeStyles,
  createStyles,
  Theme
} from '@material-ui/core'
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  CheckCircle,
  Warning
} from '@material-ui/icons'
import {
  TaxCalculationResult,
  ScenarioDifference
} from 'ustaxes/core/scenarios/scenarioEngine'
import { Currency } from 'ustaxes/components/input'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: '100%'
    },
    comparisonCard: {
      marginBottom: theme.spacing(2)
    },
    baselineCard: {
      borderLeft: `4px solid ${theme.palette.primary.main}`
    },
    scenarioCard: {
      borderLeft: `4px solid ${theme.palette.secondary.main}`
    },
    positiveChange: {
      color: theme.palette.success.main
    },
    negativeChange: {
      color: theme.palette.error.main
    },
    neutralChange: {
      color: theme.palette.text.secondary
    },
    tableHeader: {
      backgroundColor: theme.palette.grey[100],
      fontWeight: 'bold'
    },
    baselineColumn: {
      backgroundColor: theme.palette.primary.light + '20'
    },
    diffCell: {
      fontSize: '0.85rem'
    },
    barContainer: {
      height: 20,
      marginBottom: theme.spacing(1),
      backgroundColor: theme.palette.grey[200],
      borderRadius: theme.shape.borderRadius
    },
    barFill: {
      height: '100%',
      borderRadius: theme.shape.borderRadius,
      transition: 'width 0.3s ease'
    },
    summarySection: {
      marginTop: theme.spacing(2)
    },
    metricLabel: {
      fontWeight: 500,
      color: theme.palette.text.secondary
    },
    metricValue: {
      fontWeight: 'bold',
      fontSize: '1.25rem'
    },
    chipPositive: {
      backgroundColor: theme.palette.success.light,
      color: theme.palette.success.dark
    },
    chipNegative: {
      backgroundColor: theme.palette.error.light,
      color: theme.palette.error.dark
    },
    chartContainer: {
      padding: theme.spacing(2)
    }
  })
)

interface ScenarioComparisonProps {
  baseline: TaxCalculationResult
  scenarios: TaxCalculationResult[]
  differences: ScenarioDifference[]
}

/**
 * Format a number as currency
 */
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

/**
 * Format a percentage
 */
const formatPercent = (value: number): string => {
  return `${value.toFixed(2)}%`
}

/**
 * Get trend icon based on value
 */
const TrendIcon = ({
  value,
  invertColors = false
}: {
  value: number
  invertColors?: boolean
}): ReactElement => {
  const classes = useStyles()

  if (Math.abs(value) < 0.01) {
    return <TrendingFlat className={classes.neutralChange} />
  }

  const isPositive = value > 0
  const colorClass = invertColors
    ? isPositive
      ? classes.negativeChange
      : classes.positiveChange
    : isPositive
    ? classes.positiveChange
    : classes.negativeChange

  return isPositive ? (
    <TrendingUp className={colorClass} />
  ) : (
    <TrendingDown className={colorClass} />
  )
}

/**
 * Difference chip component
 */
const DiffChip = ({
  value,
  isCurrency = true,
  invertColors = false
}: {
  value: number
  isCurrency?: boolean
  invertColors?: boolean
}): ReactElement => {
  const classes = useStyles()

  if (Math.abs(value) < 0.01) {
    return <Chip size="small" label="No change" />
  }

  const isPositive = value > 0
  const chipClass = invertColors
    ? isPositive
      ? classes.chipNegative
      : classes.chipPositive
    : isPositive
    ? classes.chipPositive
    : classes.chipNegative

  const label = isCurrency
    ? `${isPositive ? '+' : ''}${formatCurrency(value)}`
    : `${isPositive ? '+' : ''}${formatPercent(value)}`

  return <Chip size="small" label={label} className={chipClass} />
}

/**
 * Bar chart visualization for comparing values
 */
const ComparisonBar = ({
  values,
  labels,
  maxValue
}: {
  values: number[]
  labels: string[]
  maxValue: number
}): ReactElement => {
  const classes = useStyles()
  const colors = ['#1976d2', '#dc004e', '#ff9800', '#4caf50']

  return (
    <Box>
      {values.map((value, idx) => {
        const width = maxValue > 0 ? (value / maxValue) * 100 : 0
        return (
          <Tooltip
            key={idx}
            title={`${labels[idx]}: ${formatCurrency(value)}`}
            arrow
          >
            <Box className={classes.barContainer}>
              <Box
                className={classes.barFill}
                style={{
                  width: `${Math.min(100, Math.max(0, width))}%`,
                  backgroundColor: colors[idx % colors.length]
                }}
              />
            </Box>
          </Tooltip>
        )
      })}
    </Box>
  )
}

/**
 * Summary card for a single scenario
 */
const ScenarioSummaryCard = ({
  result,
  diff,
  isBaseline
}: {
  result: TaxCalculationResult
  diff?: ScenarioDifference
  isBaseline: boolean
}): ReactElement => {
  const classes = useStyles()

  return (
    <Card
      className={`${classes.comparisonCard} ${
        isBaseline ? classes.baselineCard : classes.scenarioCard
      }`}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {result.scenarioName}
            {isBaseline && (
              <Chip
                size="small"
                label="Baseline"
                color="primary"
                style={{ marginLeft: 8 }}
              />
            )}
          </Typography>
          {result.calculatedSuccessfully ? (
            <CheckCircle color="primary" />
          ) : (
            <Tooltip title={result.errors.join(', ')}>
              <Warning color="error" />
            </Tooltip>
          )}
        </Box>

        <Grid container spacing={3} className={classes.summarySection}>
          <Grid item xs={6} sm={3}>
            <Typography className={classes.metricLabel}>AGI</Typography>
            <Typography className={classes.metricValue}>
              {formatCurrency(result.agi)}
            </Typography>
            {diff && <DiffChip value={diff.agiDiff} />}
          </Grid>

          <Grid item xs={6} sm={3}>
            <Typography className={classes.metricLabel}>
              Taxable Income
            </Typography>
            <Typography className={classes.metricValue}>
              {formatCurrency(result.taxableIncome)}
            </Typography>
            {diff && <DiffChip value={diff.taxableIncomeDiff} />}
          </Grid>

          <Grid item xs={6} sm={3}>
            <Typography className={classes.metricLabel}>Total Tax</Typography>
            <Typography className={classes.metricValue}>
              {formatCurrency(result.totalTax)}
            </Typography>
            {diff && <DiffChip value={diff.totalTaxDiff} invertColors />}
          </Grid>

          <Grid item xs={6} sm={3}>
            <Typography className={classes.metricLabel}>
              {result.refundAmount > 0 ? 'Refund' : 'Amount Owed'}
            </Typography>
            <Typography
              className={classes.metricValue}
              style={{
                color:
                  result.refundAmount > 0
                    ? '#4caf50'
                    : result.amountOwed > 0
                    ? '#f44336'
                    : undefined
              }}
            >
              {result.refundAmount > 0
                ? formatCurrency(result.refundAmount)
                : formatCurrency(-result.amountOwed)}
            </Typography>
            {diff && <DiffChip value={diff.refundDiff} />}
          </Grid>
        </Grid>

        <Box mt={2}>
          <Typography variant="body2" className={classes.metricLabel}>
            Effective Tax Rate: {formatPercent(result.effectiveTaxRate)}
            {diff && (
              <span style={{ marginLeft: 8 }}>
                <DiffChip
                  value={diff.effectiveRateDiff}
                  isCurrency={false}
                  invertColors
                />
              </span>
            )}
          </Typography>
          <Typography variant="body2" className={classes.metricLabel}>
            Marginal Tax Rate: {formatPercent(result.marginalTaxRate)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}

/**
 * Main comparison component
 */
const ScenarioComparison = ({
  baseline,
  scenarios,
  differences
}: ScenarioComparisonProps): ReactElement => {
  const classes = useStyles()

  // All results for table
  const allResults = useMemo(
    () => [baseline, ...scenarios],
    [baseline, scenarios]
  )

  // Find max values for bar charts
  const maxValues = useMemo(() => {
    const allVals = allResults
    return {
      agi: Math.max(...allVals.map((r) => r.agi)),
      taxableIncome: Math.max(...allVals.map((r) => r.taxableIncome)),
      totalTax: Math.max(...allVals.map((r) => r.totalTax)),
      refund: Math.max(
        ...allVals.map((r) => Math.abs(r.refundAmount - r.amountOwed))
      )
    }
  }, [allResults])

  // Map differences by scenario ID
  const diffMap = useMemo(() => {
    const map: { [id: string]: ScenarioDifference } = {}
    differences.forEach((d) => {
      map[d.scenarioId] = d
    })
    return map
  }, [differences])

  if (!baseline.calculatedSuccessfully && scenarios.length === 0) {
    return (
      <Box p={3}>
        <Typography color="error">
          Unable to calculate baseline taxes. Please ensure your tax information
          is complete.
        </Typography>
      </Box>
    )
  }

  return (
    <Box className={classes.root}>
      {/* Summary Cards */}
      <Typography variant="h5" gutterBottom>
        Scenario Comparison
      </Typography>

      <ScenarioSummaryCard result={baseline} isBaseline />

      {scenarios.map((scenario) => (
        <ScenarioSummaryCard
          key={scenario.scenarioId}
          result={scenario}
          diff={diffMap[scenario.scenarioId]}
          isBaseline={false}
        />
      ))}

      {/* Detailed Comparison Table */}
      {scenarios.length > 0 && (
        <Box mt={4}>
          <Typography variant="h6" gutterBottom>
            Detailed Comparison
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow className={classes.tableHeader}>
                  <TableCell>Metric</TableCell>
                  <TableCell align="right" className={classes.baselineColumn}>
                    {baseline.scenarioName}
                  </TableCell>
                  {scenarios.map((s) => (
                    <TableCell key={s.scenarioId} align="right">
                      {s.scenarioName}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Income Section */}
                <TableRow>
                  <TableCell colSpan={allResults.length + 1}>
                    <strong>Income</strong>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Wages</TableCell>
                  <TableCell align="right" className={classes.baselineColumn}>
                    {formatCurrency(baseline.wagesIncome)}
                  </TableCell>
                  {scenarios.map((s) => (
                    <TableCell key={s.scenarioId} align="right">
                      {formatCurrency(s.wagesIncome)}
                      <Box className={classes.diffCell}>
                        <TrendIcon
                          value={s.wagesIncome - baseline.wagesIncome}
                        />
                      </Box>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>Total Income</TableCell>
                  <TableCell align="right" className={classes.baselineColumn}>
                    {formatCurrency(baseline.totalIncome)}
                  </TableCell>
                  {scenarios.map((s) => (
                    <TableCell key={s.scenarioId} align="right">
                      {formatCurrency(s.totalIncome)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>AGI</strong>
                  </TableCell>
                  <TableCell align="right" className={classes.baselineColumn}>
                    <strong>{formatCurrency(baseline.agi)}</strong>
                  </TableCell>
                  {scenarios.map((s) => (
                    <TableCell key={s.scenarioId} align="right">
                      <strong>{formatCurrency(s.agi)}</strong>
                    </TableCell>
                  ))}
                </TableRow>

                {/* Deductions Section */}
                <TableRow>
                  <TableCell colSpan={allResults.length + 1}>
                    <strong>Deductions</strong>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Standard Deduction</TableCell>
                  <TableCell align="right" className={classes.baselineColumn}>
                    {formatCurrency(baseline.standardDeduction)}
                  </TableCell>
                  {scenarios.map((s) => (
                    <TableCell key={s.scenarioId} align="right">
                      {formatCurrency(s.standardDeduction)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>Deduction Used</TableCell>
                  <TableCell align="right" className={classes.baselineColumn}>
                    {formatCurrency(baseline.deductionUsed)}
                  </TableCell>
                  {scenarios.map((s) => (
                    <TableCell key={s.scenarioId} align="right">
                      {formatCurrency(s.deductionUsed)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Taxable Income</strong>
                  </TableCell>
                  <TableCell align="right" className={classes.baselineColumn}>
                    <strong>{formatCurrency(baseline.taxableIncome)}</strong>
                  </TableCell>
                  {scenarios.map((s) => (
                    <TableCell key={s.scenarioId} align="right">
                      <strong>{formatCurrency(s.taxableIncome)}</strong>
                    </TableCell>
                  ))}
                </TableRow>

                {/* Tax Section */}
                <TableRow>
                  <TableCell colSpan={allResults.length + 1}>
                    <strong>Tax Calculation</strong>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Tax Before Credits</TableCell>
                  <TableCell align="right" className={classes.baselineColumn}>
                    {formatCurrency(baseline.taxBeforeCredits)}
                  </TableCell>
                  {scenarios.map((s) => (
                    <TableCell key={s.scenarioId} align="right">
                      {formatCurrency(s.taxBeforeCredits)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>Total Credits</TableCell>
                  <TableCell align="right" className={classes.baselineColumn}>
                    {formatCurrency(baseline.totalCredits)}
                  </TableCell>
                  {scenarios.map((s) => (
                    <TableCell key={s.scenarioId} align="right">
                      {formatCurrency(s.totalCredits)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Total Tax</strong>
                  </TableCell>
                  <TableCell align="right" className={classes.baselineColumn}>
                    <strong>{formatCurrency(baseline.totalTax)}</strong>
                  </TableCell>
                  {scenarios.map((s) => (
                    <TableCell key={s.scenarioId} align="right">
                      <strong>{formatCurrency(s.totalTax)}</strong>
                    </TableCell>
                  ))}
                </TableRow>

                {/* Payments & Result Section */}
                <TableRow>
                  <TableCell colSpan={allResults.length + 1}>
                    <strong>Payments & Result</strong>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Withholdings</TableCell>
                  <TableCell align="right" className={classes.baselineColumn}>
                    {formatCurrency(baseline.withholdings)}
                  </TableCell>
                  {scenarios.map((s) => (
                    <TableCell key={s.scenarioId} align="right">
                      {formatCurrency(s.withholdings)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>Estimated Payments</TableCell>
                  <TableCell align="right" className={classes.baselineColumn}>
                    {formatCurrency(baseline.estimatedPayments)}
                  </TableCell>
                  {scenarios.map((s) => (
                    <TableCell key={s.scenarioId} align="right">
                      {formatCurrency(s.estimatedPayments)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Refund / (Owed)</strong>
                  </TableCell>
                  <TableCell align="right" className={classes.baselineColumn}>
                    <strong
                      style={{
                        color: baseline.refundAmount > 0 ? '#4caf50' : '#f44336'
                      }}
                    >
                      {formatCurrency(
                        baseline.refundAmount > 0
                          ? baseline.refundAmount
                          : -baseline.amountOwed
                      )}
                    </strong>
                  </TableCell>
                  {scenarios.map((s) => (
                    <TableCell key={s.scenarioId} align="right">
                      <strong
                        style={{
                          color: s.refundAmount > 0 ? '#4caf50' : '#f44336'
                        }}
                      >
                        {formatCurrency(
                          s.refundAmount > 0 ? s.refundAmount : -s.amountOwed
                        )}
                      </strong>
                    </TableCell>
                  ))}
                </TableRow>

                {/* Rates Section */}
                <TableRow>
                  <TableCell colSpan={allResults.length + 1}>
                    <strong>Tax Rates</strong>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Effective Rate</TableCell>
                  <TableCell align="right" className={classes.baselineColumn}>
                    {formatPercent(baseline.effectiveTaxRate)}
                  </TableCell>
                  {scenarios.map((s) => (
                    <TableCell key={s.scenarioId} align="right">
                      {formatPercent(s.effectiveTaxRate)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>Marginal Rate</TableCell>
                  <TableCell align="right" className={classes.baselineColumn}>
                    {formatPercent(baseline.marginalTaxRate)}
                  </TableCell>
                  {scenarios.map((s) => (
                    <TableCell key={s.scenarioId} align="right">
                      {formatPercent(s.marginalTaxRate)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Visual Bar Chart Comparison */}
      {scenarios.length > 0 && (
        <Box mt={4} className={classes.chartContainer}>
          <Typography variant="h6" gutterBottom>
            Visual Comparison
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Total Tax
              </Typography>
              <ComparisonBar
                values={allResults.map((r) => r.totalTax)}
                labels={allResults.map((r) => r.scenarioName)}
                maxValue={maxValues.totalTax}
              />
              <Box display="flex" justifyContent="space-between" mt={1}>
                {allResults.map((r, idx) => (
                  <Typography key={idx} variant="caption">
                    {r.scenarioName}: {formatCurrency(r.totalTax)}
                  </Typography>
                ))}
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Refund / Amount Owed
              </Typography>
              <ComparisonBar
                values={allResults.map((r) =>
                  Math.abs(r.refundAmount - r.amountOwed)
                )}
                labels={allResults.map((r) => r.scenarioName)}
                maxValue={maxValues.refund}
              />
              <Box display="flex" justifyContent="space-between" mt={1}>
                {allResults.map((r, idx) => (
                  <Typography key={idx} variant="caption">
                    {r.scenarioName}:{' '}
                    {formatCurrency(
                      r.refundAmount > 0 ? r.refundAmount : -r.amountOwed
                    )}
                  </Typography>
                ))}
              </Box>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  )
}

export default ScenarioComparison
