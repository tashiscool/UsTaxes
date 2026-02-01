import { ReactElement, useState, useMemo } from 'react'
import { Helmet } from 'react-helmet'
import { useSelector } from 'react-redux'
import {
  Box,
  Grid,
  Paper,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Divider,
  makeStyles,
  createStyles,
  Theme,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow
} from '@material-ui/core'
import {
  Assessment,
  TrendingUp,
  EmojiObjects,
  Compare
} from '@material-ui/icons'
import { YearsTaxesState } from 'ustaxes/redux'
import { FilingStatus, TaxYear } from 'ustaxes/core/data'
import {
  TaxInputs,
  TaxBreakdown,
  calculateTax,
  getFederalTaxData
} from 'ustaxes/core/planning/taxCalculator'
import { Currency } from 'ustaxes/components/input'
import WhatIfScenario from './WhatIfScenario'
import TaxProjection from './TaxProjection'
import Recommendations from './Recommendations'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      padding: theme.spacing(2)
    },
    paper: {
      padding: theme.spacing(3),
      marginBottom: theme.spacing(2)
    },
    summaryCard: {
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
    tabPanel: {
      padding: theme.spacing(3, 0)
    },
    bracketBar: {
      display: 'flex',
      height: 24,
      borderRadius: 4,
      overflow: 'hidden',
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(2)
    },
    bracketSegment: {
      transition: 'width 0.3s ease'
    },
    bracketLegend: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      marginTop: theme.spacing(1)
    },
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      marginRight: theme.spacing(2)
    },
    legendColor: {
      width: 16,
      height: 16,
      borderRadius: 2,
      marginRight: theme.spacing(0.5)
    },
    comparisonTable: {
      '& th': {
        fontWeight: 'bold'
      }
    },
    highlightRow: {
      backgroundColor: theme.palette.action.hover
    }
  })
)

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps): ReactElement {
  const { children, value, index, ...other } = props
  const classes = useStyles()

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`planning-tabpanel-${index}`}
      aria-labelledby={`planning-tab-${index}`}
      className={classes.tabPanel}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  )
}

const bracketColors = [
  '#4caf50', // 10% - green
  '#8bc34a', // 12% - light green
  '#ffeb3b', // 22% - yellow
  '#ffc107', // 24% - amber
  '#ff9800', // 32% - orange
  '#ff5722', // 35% - deep orange
  '#f44336' // 37% - red
]

export default function TaxPlanningCalculator(): ReactElement {
  const classes = useStyles()
  const [activeTab, setActiveTab] = useState(0)

  // Get data from redux state
  const activeYear: TaxYear = useSelector(
    (state: YearsTaxesState) => state.activeYear
  )

  const information = useSelector((state: YearsTaxesState) => state[activeYear])

  // Convert redux state to TaxInputs
  const currentInputs = useMemo((): TaxInputs => {
    const filingStatus = information.taxPayer.filingStatus ?? FilingStatus.S

    // Calculate total wages from W2s
    const wages = information.w2s.reduce((sum, w2) => sum + w2.income, 0)

    // Calculate federal withholding from W2s
    const federalWithholding = information.w2s.reduce(
      (sum, w2) => sum + w2.fedWithholding,
      0
    )

    // Calculate 1099 income
    let interestIncome = 0
    let dividendIncome = 0
    let qualifiedDividends = 0
    let shortTermCapitalGains = 0
    let longTermCapitalGains = 0

    information.f1099s.forEach((f1099) => {
      if (f1099.type === 'INT') {
        interestIncome += (f1099.form as { income: number }).income
      } else if (f1099.type === 'DIV') {
        const div = f1099.form as {
          dividends: number
          qualifiedDividends: number
        }
        dividendIncome += div.dividends
        qualifiedDividends += div.qualifiedDividends
      } else if (f1099.type === 'B') {
        const b = f1099.form as {
          shortTermProceeds: number
          shortTermCostBasis: number
          longTermProceeds: number
          longTermCostBasis: number
        }
        shortTermCapitalGains += b.shortTermProceeds - b.shortTermCostBasis
        longTermCapitalGains += b.longTermProceeds - b.longTermCostBasis
      }
    })

    // Calculate IRA contributions
    const iraContribution = information.individualRetirementArrangements.reduce(
      (sum, ira) => sum + ira.contributions,
      0
    )

    // Calculate HSA contributions
    const hsaContribution = information.healthSavingsAccounts.reduce(
      (sum, hsa) => sum + hsa.contributions,
      0
    )

    // Calculate estimated tax payments
    const estimatedPayments = information.estimatedTaxes.reduce(
      (sum, et) => sum + et.payment,
      0
    )

    // Calculate student loan interest
    const studentLoanInterest = information.f1098es.reduce(
      (sum, f1098) => sum + f1098.interest,
      0
    )

    // Calculate itemized deductions
    const itemized = information.itemizedDeductions
    const itemizedAmount = itemized
      ? Number(itemized.medicalAndDental || 0) +
        Number(itemized.stateAndLocalTaxes || 0) +
        Number(itemized.stateAndLocalRealEstateTaxes || 0) +
        Number(itemized.stateAndLocalPropertyTaxes || 0) +
        Number(itemized.interest8a || 0) +
        Number(itemized.interest8b || 0) +
        Number(itemized.charityCashCheck || 0) +
        Number(itemized.charityOther || 0)
      : 0

    const yearNumber = parseInt(activeYear.replace('Y', ''), 10)

    return {
      filingStatus,
      wages,
      interestIncome,
      dividendIncome,
      qualifiedDividends,
      shortTermCapitalGains: Math.max(0, shortTermCapitalGains),
      longTermCapitalGains: Math.max(0, longTermCapitalGains),
      otherIncome: 0,
      adjustments: {
        iraContribution,
        hsaContribution,
        studentLoanInterest: Math.min(studentLoanInterest, 2500),
        selfEmploymentTax: 0,
        otherAdjustments: 0
      },
      deductions: {
        useItemized: itemizedAmount > 0,
        itemizedAmount
      },
      credits: {
        childTaxCredit: 0,
        earnedIncomeCredit: 0,
        educationCredits: 0,
        otherCredits: 0
      },
      payments: {
        federalWithholding,
        estimatedPayments
      },
      dependents: information.taxPayer.dependents.length,
      year: yearNumber
    }
  }, [information, activeYear])

  // Calculate current tax breakdown
  const currentBreakdown = useMemo((): TaxBreakdown => {
    return calculateTax(currentInputs)
  }, [currentInputs])

  // State for scenario comparison (can be used for side-by-side display)
  const [, setScenarioBreakdown] = useState<TaxBreakdown | null>(null)

  const handleTabChange = (
    _event: React.ChangeEvent<unknown>,
    newValue: number
  ) => {
    setActiveTab(newValue)
  }

  const taxData = getFederalTaxData(currentInputs.year)

  // Calculate bracket visualization data
  const bracketVisualization = useMemo(() => {
    const totalTax = currentBreakdown.totalTaxBeforeCredits
    if (totalTax === 0) return []

    return currentBreakdown.bracketBreakdown.map((bracket, index) => ({
      ...bracket,
      percentage: (bracket.taxInBracket / totalTax) * 100,
      color: bracketColors[index] || bracketColors[bracketColors.length - 1]
    }))
  }, [currentBreakdown])

  return (
    <Box className={classes.root}>
      <Helmet>
        <title>Tax Planning Calculator | UsTaxes.org</title>
      </Helmet>

      <Typography variant="h4" gutterBottom>
        Tax Planning Calculator
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Plan your taxes, explore what-if scenarios, and find opportunities to
        save
      </Typography>

      {/* Current Year Summary */}
      <Paper className={classes.paper}>
        <Typography variant="h6" gutterBottom>
          <Assessment style={{ verticalAlign: 'middle', marginRight: 8 }} />
          {activeYear.replace('Y', '')} Tax Summary
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card className={classes.summaryCard}>
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">
                  Gross Income
                </Typography>
                <Typography variant="h5">
                  <Currency value={currentBreakdown.grossIncome} plain />
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card className={classes.summaryCard}>
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">
                  Taxable Income
                </Typography>
                <Typography variant="h5">
                  <Currency value={currentBreakdown.taxableIncome} plain />
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card className={classes.summaryCard}>
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">
                  Total Tax
                </Typography>
                <Typography variant="h5">
                  <Currency value={currentBreakdown.totalTax} plain />
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card className={classes.summaryCard}>
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">
                  {currentBreakdown.refundOrOwed >= 0
                    ? 'Refund'
                    : 'Amount Owed'}
                </Typography>
                <Typography
                  variant="h5"
                  className={
                    currentBreakdown.refundOrOwed >= 0
                      ? classes.positive
                      : classes.negative
                  }
                >
                  <Currency
                    value={Math.abs(currentBreakdown.refundOrOwed)}
                    plain
                  />
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tax Rate Summary */}
        <Grid container spacing={3} style={{ marginTop: 16 }}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="textSecondary">
              Tax Rates
            </Typography>
            <Box display="flex" alignItems="baseline" style={{ gap: 32 }}>
              <Box>
                <Typography variant="h4">
                  {currentBreakdown.effectiveTaxRate.toFixed(1)}%
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Effective Rate
                </Typography>
              </Box>
              <Box>
                <Typography variant="h4">
                  {currentBreakdown.marginalTaxRate}%
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Marginal Rate
                </Typography>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>
              Tax by Bracket
            </Typography>
            <Box className={classes.bracketBar}>
              {bracketVisualization.map((bracket, index) => (
                <Box
                  key={index}
                  className={classes.bracketSegment}
                  style={{
                    width: `${bracket.percentage}%`,
                    backgroundColor: bracket.color
                  }}
                  title={`${
                    bracket.rate
                  }%: $${bracket.taxInBracket.toLocaleString()}`}
                />
              ))}
            </Box>
            <Box className={classes.bracketLegend}>
              {bracketVisualization.map((bracket, index) => (
                <Box key={index} className={classes.legendItem}>
                  <Box
                    className={classes.legendColor}
                    style={{ backgroundColor: bracket.color }}
                  />
                  <Typography variant="caption">
                    {bracket.rate}%:{' '}
                    <Currency value={bracket.taxInBracket} plain />
                  </Typography>
                </Box>
              ))}
            </Box>
          </Grid>
        </Grid>

        {/* Detailed Breakdown Table */}
        <Box mt={3}>
          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
            Detailed Breakdown
          </Typography>
          <TableContainer>
            <Table size="small" className={classes.comparisonTable}>
              <TableBody>
                <TableRow>
                  <TableCell>Gross Income</TableCell>
                  <TableCell align="right">
                    <Currency value={currentBreakdown.grossIncome} plain />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Less: Adjustments (Above-the-line)</TableCell>
                  <TableCell align="right">
                    <Currency
                      value={
                        currentBreakdown.grossIncome -
                        currentBreakdown.adjustedGrossIncome
                      }
                      plain
                    />
                  </TableCell>
                </TableRow>
                <TableRow className={classes.highlightRow}>
                  <TableCell>
                    <strong>Adjusted Gross Income (AGI)</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>
                      <Currency
                        value={currentBreakdown.adjustedGrossIncome}
                        plain
                      />
                    </strong>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    Less: Deduction (
                    {currentInputs.deductions.useItemized
                      ? 'Itemized'
                      : 'Standard'}
                    )
                  </TableCell>
                  <TableCell align="right">
                    <Currency
                      value={
                        currentInputs.deductions.useItemized
                          ? currentInputs.deductions.itemizedAmount
                          : taxData.standardDeduction[
                              currentInputs.filingStatus
                            ]
                      }
                      plain
                    />
                  </TableCell>
                </TableRow>
                <TableRow className={classes.highlightRow}>
                  <TableCell>
                    <strong>Taxable Income</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>
                      <Currency value={currentBreakdown.taxableIncome} plain />
                    </strong>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Ordinary Income Tax</TableCell>
                  <TableCell align="right">
                    <Currency
                      value={currentBreakdown.ordinaryIncomeTax}
                      plain
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Capital Gains Tax</TableCell>
                  <TableCell align="right">
                    <Currency value={currentBreakdown.capitalGainsTax} plain />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Total Tax Before Credits</TableCell>
                  <TableCell align="right">
                    <Currency
                      value={currentBreakdown.totalTaxBeforeCredits}
                      plain
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Less: Credits</TableCell>
                  <TableCell align="right">
                    <Currency value={currentBreakdown.totalCredits} plain />
                  </TableCell>
                </TableRow>
                <TableRow className={classes.highlightRow}>
                  <TableCell>
                    <strong>Total Tax</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>
                      <Currency value={currentBreakdown.totalTax} plain />
                    </strong>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    Total Payments (Withholding + Estimated)
                  </TableCell>
                  <TableCell align="right">
                    <Currency value={currentBreakdown.totalPayments} plain />
                  </TableCell>
                </TableRow>
                <TableRow className={classes.highlightRow}>
                  <TableCell>
                    <strong>
                      {currentBreakdown.refundOrOwed >= 0
                        ? 'Refund Due'
                        : 'Amount Owed'}
                    </strong>
                  </TableCell>
                  <TableCell
                    align="right"
                    className={
                      currentBreakdown.refundOrOwed >= 0
                        ? classes.positive
                        : classes.negative
                    }
                  >
                    <strong>
                      <Currency
                        value={Math.abs(currentBreakdown.refundOrOwed)}
                        plain
                      />
                    </strong>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Paper>

      {/* Planning Tabs */}
      <Paper className={classes.paper}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab
            icon={<Compare />}
            label="What-If Scenarios"
            id="planning-tab-0"
          />
          <Tab
            icon={<TrendingUp />}
            label="Next Year Projection"
            id="planning-tab-1"
          />
          <Tab
            icon={<EmojiObjects />}
            label="Recommendations"
            id="planning-tab-2"
          />
        </Tabs>

        <Divider />

        <TabPanel value={activeTab} index={0}>
          <WhatIfScenario
            baseInputs={currentInputs}
            baseBreakdown={currentBreakdown}
            onScenarioChange={(inputs, breakdown) =>
              setScenarioBreakdown(breakdown)
            }
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <TaxProjection
            currentInputs={currentInputs}
            currentBreakdown={currentBreakdown}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Recommendations
            inputs={currentInputs}
            breakdown={currentBreakdown}
          />
        </TabPanel>
      </Paper>
    </Box>
  )
}
