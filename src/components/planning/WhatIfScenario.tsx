import { ReactElement, useState, useMemo } from 'react'
import {
  Box,
  Grid,
  Paper,
  Typography,
  Slider,
  TextField,
  InputAdornment,
  Divider,
  Card,
  CardContent,
  makeStyles,
  createStyles,
  Theme
} from '@material-ui/core'
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  LocalHospital
} from '@material-ui/icons'
import {
  TaxInputs,
  TaxBreakdown,
  calculateTax
} from 'ustaxes/core/planning/taxCalculator'
import { Currency } from 'ustaxes/components/input'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    paper: {
      padding: theme.spacing(3),
      marginBottom: theme.spacing(2)
    },
    sliderContainer: {
      padding: theme.spacing(2, 3)
    },
    resultCard: {
      height: '100%'
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
    comparisonGrid: {
      marginTop: theme.spacing(2)
    },
    rateBox: {
      padding: theme.spacing(2),
      textAlign: 'center',
      borderRadius: theme.shape.borderRadius,
      backgroundColor: theme.palette.grey[100]
    },
    changeIndicator: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing(1)
    },
    inputField: {
      marginBottom: theme.spacing(2)
    },
    barContainer: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1)
    },
    bar: {
      height: 24,
      borderRadius: 4,
      transition: 'width 0.3s ease'
    },
    barLabel: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: theme.spacing(0.5)
    }
  })
)

interface WhatIfScenarioProps {
  baseInputs: TaxInputs
  baseBreakdown: TaxBreakdown
  onScenarioChange?: (inputs: TaxInputs, breakdown: TaxBreakdown) => void
}

interface ScenarioAdjustments {
  additionalIncome: number
  iraContribution: number
  hsaContribution: number
  additionalWithholding: number
  charitableGiving: number
}

const defaultAdjustments: ScenarioAdjustments = {
  additionalIncome: 0,
  iraContribution: 0,
  hsaContribution: 0,
  additionalWithholding: 0,
  charitableGiving: 0
}

export default function WhatIfScenario({
  baseInputs,
  baseBreakdown,
  onScenarioChange
}: WhatIfScenarioProps): ReactElement {
  const classes = useStyles()
  const [adjustments, setAdjustments] =
    useState<ScenarioAdjustments>(defaultAdjustments)

  // Calculate scenario breakdown based on adjustments
  const scenarioBreakdown = useMemo(() => {
    const scenarioInputs: TaxInputs = {
      ...baseInputs,
      wages: baseInputs.wages + adjustments.additionalIncome,
      adjustments: {
        ...baseInputs.adjustments,
        iraContribution:
          baseInputs.adjustments.iraContribution + adjustments.iraContribution,
        hsaContribution:
          baseInputs.adjustments.hsaContribution + adjustments.hsaContribution
      },
      deductions: {
        ...baseInputs.deductions,
        itemizedAmount:
          baseInputs.deductions.itemizedAmount + adjustments.charitableGiving
      },
      payments: {
        ...baseInputs.payments,
        federalWithholding:
          baseInputs.payments.federalWithholding +
          adjustments.additionalWithholding
      }
    }

    const breakdown = calculateTax(scenarioInputs)

    if (onScenarioChange) {
      onScenarioChange(scenarioInputs, breakdown)
    }

    return breakdown
  }, [baseInputs, adjustments, onScenarioChange])

  const taxChange = scenarioBreakdown.totalTax - baseBreakdown.totalTax
  const refundChange =
    scenarioBreakdown.refundOrOwed - baseBreakdown.refundOrOwed

  const handleSliderChange =
    (field: keyof ScenarioAdjustments) =>
    (_event: React.ChangeEvent<unknown>, value: number | number[]) => {
      setAdjustments((prev) => ({
        ...prev,
        [field]: value as number
      }))
    }

  const handleInputChange =
    (field: keyof ScenarioAdjustments) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(event.target.value) || 0
      setAdjustments((prev) => ({
        ...prev,
        [field]: value
      }))
    }

  const formatCurrency = (value: number): string => {
    return `$${value.toLocaleString()}`
  }

  // Simple bar chart component
  const TaxBar = ({
    label,
    current,
    projected,
    maxValue
  }: {
    label: string
    current: number
    projected: number
    maxValue: number
  }) => {
    const currentWidth = (current / maxValue) * 100
    const projectedWidth = (projected / maxValue) * 100

    return (
      <Box className={classes.barContainer}>
        <Typography variant="body2" className={classes.barLabel}>
          <span>{label}</span>
        </Typography>
        <Box position="relative">
          <Box
            className={classes.bar}
            style={{
              width: `${currentWidth}%`,
              backgroundColor: '#90caf9',
              position: 'absolute'
            }}
          />
          <Box
            className={classes.bar}
            style={{
              width: `${projectedWidth}%`,
              backgroundColor:
                projected > current
                  ? 'rgba(244, 67, 54, 0.7)'
                  : 'rgba(76, 175, 80, 0.7)',
              position: 'relative',
              zIndex: 1
            }}
          />
        </Box>
        <Box display="flex" justifyContent="space-between" mt={0.5}>
          <Typography variant="caption" color="textSecondary">
            Current: {formatCurrency(current)}
          </Typography>
          <Typography
            variant="caption"
            className={
              projected > current ? classes.negative : classes.positive
            }
          >
            Projected: {formatCurrency(projected)}
          </Typography>
        </Box>
      </Box>
    )
  }

  const maxBarValue =
    Math.max(
      baseBreakdown.totalTax,
      scenarioBreakdown.totalTax,
      baseBreakdown.totalPayments,
      scenarioBreakdown.totalPayments
    ) * 1.1

  return (
    <Box>
      <Paper className={classes.paper}>
        <Typography variant="h6" gutterBottom>
          What-If Scenario Builder
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Adjust the sliders below to see how changes would affect your tax
          situation
        </Typography>

        <Grid container spacing={4}>
          {/* Adjustment Controls */}
          <Grid item xs={12} md={6}>
            <Box className={classes.sliderContainer}>
              <Typography gutterBottom>
                <TrendingUp
                  fontSize="small"
                  style={{ verticalAlign: 'middle', marginRight: 8 }}
                />
                Additional Income
              </Typography>
              <Slider
                value={adjustments.additionalIncome}
                onChange={handleSliderChange('additionalIncome')}
                min={0}
                max={50000}
                step={1000}
                valueLabelDisplay="auto"
                valueLabelFormat={formatCurrency}
              />
              <TextField
                size="small"
                type="number"
                value={adjustments.additionalIncome}
                onChange={handleInputChange('additionalIncome')}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  )
                }}
                className={classes.inputField}
              />
            </Box>

            <Box className={classes.sliderContainer}>
              <Typography gutterBottom>
                <AccountBalance
                  fontSize="small"
                  style={{ verticalAlign: 'middle', marginRight: 8 }}
                />
                Additional IRA Contribution
              </Typography>
              <Slider
                value={adjustments.iraContribution}
                onChange={handleSliderChange('iraContribution')}
                min={0}
                max={7000}
                step={100}
                valueLabelDisplay="auto"
                valueLabelFormat={formatCurrency}
              />
              <TextField
                size="small"
                type="number"
                value={adjustments.iraContribution}
                onChange={handleInputChange('iraContribution')}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  )
                }}
                className={classes.inputField}
              />
            </Box>

            <Box className={classes.sliderContainer}>
              <Typography gutterBottom>
                <LocalHospital
                  fontSize="small"
                  style={{ verticalAlign: 'middle', marginRight: 8 }}
                />
                Additional HSA Contribution
              </Typography>
              <Slider
                value={adjustments.hsaContribution}
                onChange={handleSliderChange('hsaContribution')}
                min={0}
                max={8300}
                step={100}
                valueLabelDisplay="auto"
                valueLabelFormat={formatCurrency}
              />
              <TextField
                size="small"
                type="number"
                value={adjustments.hsaContribution}
                onChange={handleInputChange('hsaContribution')}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  )
                }}
                className={classes.inputField}
              />
            </Box>

            <Box className={classes.sliderContainer}>
              <Typography gutterBottom>Additional Withholding</Typography>
              <Slider
                value={adjustments.additionalWithholding}
                onChange={handleSliderChange('additionalWithholding')}
                min={0}
                max={20000}
                step={500}
                valueLabelDisplay="auto"
                valueLabelFormat={formatCurrency}
              />
              <TextField
                size="small"
                type="number"
                value={adjustments.additionalWithholding}
                onChange={handleInputChange('additionalWithholding')}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  )
                }}
                className={classes.inputField}
              />
            </Box>

            <Box className={classes.sliderContainer}>
              <Typography gutterBottom>Additional Charitable Giving</Typography>
              <Slider
                value={adjustments.charitableGiving}
                onChange={handleSliderChange('charitableGiving')}
                min={0}
                max={25000}
                step={500}
                valueLabelDisplay="auto"
                valueLabelFormat={formatCurrency}
              />
              <TextField
                size="small"
                type="number"
                value={adjustments.charitableGiving}
                onChange={handleInputChange('charitableGiving')}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  )
                }}
                className={classes.inputField}
              />
            </Box>
          </Grid>

          {/* Results Display */}
          <Grid item xs={12} md={6}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Card className={classes.resultCard}>
                  <CardContent>
                    <Typography variant="subtitle2" color="textSecondary">
                      Marginal Tax Rate
                    </Typography>
                    <Typography variant="h4">
                      {scenarioBreakdown.marginalTaxRate}%
                    </Typography>
                    {scenarioBreakdown.marginalTaxRate !==
                      baseBreakdown.marginalTaxRate && (
                      <Typography
                        variant="body2"
                        className={
                          scenarioBreakdown.marginalTaxRate >
                          baseBreakdown.marginalTaxRate
                            ? classes.negative
                            : classes.positive
                        }
                      >
                        {scenarioBreakdown.marginalTaxRate >
                        baseBreakdown.marginalTaxRate
                          ? 'Moved to higher bracket'
                          : 'Moved to lower bracket'}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={6}>
                <Card className={classes.resultCard}>
                  <CardContent>
                    <Typography variant="subtitle2" color="textSecondary">
                      Effective Tax Rate
                    </Typography>
                    <Typography variant="h4">
                      {scenarioBreakdown.effectiveTaxRate.toFixed(1)}%
                    </Typography>
                    <Typography
                      variant="body2"
                      className={
                        scenarioBreakdown.effectiveTaxRate >
                        baseBreakdown.effectiveTaxRate
                          ? classes.negative
                          : classes.positive
                      }
                    >
                      {scenarioBreakdown.effectiveTaxRate >
                      baseBreakdown.effectiveTaxRate
                        ? '+'
                        : ''}
                      {(
                        scenarioBreakdown.effectiveTaxRate -
                        baseBreakdown.effectiveTaxRate
                      ).toFixed(2)}
                      % from current
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="textSecondary">
                      Tax Change
                    </Typography>
                    <Box className={classes.changeIndicator}>
                      {taxChange > 0 ? (
                        <TrendingUp className={classes.negative} />
                      ) : taxChange < 0 ? (
                        <TrendingDown className={classes.positive} />
                      ) : null}
                      <Typography
                        variant="h5"
                        className={
                          taxChange > 0
                            ? classes.negative
                            : taxChange < 0
                            ? classes.positive
                            : classes.neutral
                        }
                        style={{ marginLeft: 8 }}
                      >
                        {taxChange >= 0 ? '+' : ''}
                        <Currency value={taxChange} plain />
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      align="center"
                    >
                      {taxChange > 0
                        ? 'Your tax liability would increase'
                        : taxChange < 0
                        ? 'You would save on taxes'
                        : 'No change in tax liability'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="textSecondary">
                      Refund / Amount Owed Change
                    </Typography>
                    <Box className={classes.changeIndicator}>
                      {refundChange > 0 ? (
                        <TrendingUp className={classes.positive} />
                      ) : refundChange < 0 ? (
                        <TrendingDown className={classes.negative} />
                      ) : null}
                      <Typography
                        variant="h5"
                        className={
                          refundChange > 0
                            ? classes.positive
                            : refundChange < 0
                            ? classes.negative
                            : classes.neutral
                        }
                        style={{ marginLeft: 8 }}
                      >
                        {refundChange >= 0 ? '+' : ''}
                        <Currency value={refundChange} plain />
                      </Typography>
                    </Box>
                    <Divider style={{ margin: '16px 0' }} />
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Current:{' '}
                        {baseBreakdown.refundOrOwed >= 0
                          ? 'Refund'
                          : 'Amount Owed'}
                      </Typography>
                      <Typography
                        variant="body2"
                        className={
                          baseBreakdown.refundOrOwed >= 0
                            ? classes.positive
                            : classes.negative
                        }
                      >
                        <Currency
                          value={Math.abs(baseBreakdown.refundOrOwed)}
                          plain
                        />
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Projected:{' '}
                        {scenarioBreakdown.refundOrOwed >= 0
                          ? 'Refund'
                          : 'Amount Owed'}
                      </Typography>
                      <Typography
                        variant="body2"
                        className={
                          scenarioBreakdown.refundOrOwed >= 0
                            ? classes.positive
                            : classes.negative
                        }
                      >
                        <Currency
                          value={Math.abs(scenarioBreakdown.refundOrOwed)}
                          plain
                        />
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>
        </Grid>

        {/* Visual Comparison */}
        <Box mt={4}>
          <Typography variant="h6" gutterBottom>
            Tax Comparison
          </Typography>
          <TaxBar
            label="Total Tax"
            current={baseBreakdown.totalTax}
            projected={scenarioBreakdown.totalTax}
            maxValue={maxBarValue}
          />
          <TaxBar
            label="Total Payments"
            current={baseBreakdown.totalPayments}
            projected={scenarioBreakdown.totalPayments}
            maxValue={maxBarValue}
          />
          <TaxBar
            label="Taxable Income"
            current={baseBreakdown.taxableIncome}
            projected={scenarioBreakdown.taxableIncome}
            maxValue={
              Math.max(
                baseBreakdown.taxableIncome,
                scenarioBreakdown.taxableIncome
              ) * 1.1
            }
          />
        </Box>
      </Paper>
    </Box>
  )
}
