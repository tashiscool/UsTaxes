/**
 * CostBasisTracker Component
 *
 * Main UI for the cost basis tracking system.
 * Features:
 * - Portfolio overview with all holdings
 * - Add/edit positions
 * - View cost basis by lot
 * - Unrealized gains/losses display
 * - Tax lot selection for sales
 */

import { ReactElement, useState, useMemo } from 'react'
import { Helmet } from 'react-helmet'
import {
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  Dialog,
  DialogContent,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery
} from '@material-ui/core'
import { makeStyles, Theme, createStyles } from '@material-ui/core/styles'
import {
  Add,
  Delete,
  Edit,
  ExpandLess,
  ExpandMore,
  TrendingUp,
  TrendingDown,
  AccountBalance
} from '@material-ui/icons'
import { useSelector } from 'react-redux'
import { YearsTaxesState } from 'ustaxes/redux'
import {
  Investment,
  StockTransaction,
  TaxLotSelection,
  CostBasisMethod,
  CostBasisPortfolio,
  TaxYears
} from 'ustaxes/core/data'
import Currency from 'ustaxes/components/input/Currency'
import PositionEditor from './PositionEditor'
import {
  processBuyTransaction,
  processSellTransaction,
  calculateGainLossSummary,
  applyStockSplit,
  createInvestment
} from 'ustaxes/core/investments/costBasis'
import { usePager } from 'ustaxes/components/pager'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      padding: theme.spacing(2)
    },
    summaryCard: {
      marginBottom: theme.spacing(2)
    },
    gain: {
      color: theme.palette.success.main
    },
    loss: {
      color: theme.palette.error.main
    },
    positionCard: {
      marginBottom: theme.spacing(2)
    },
    positionHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      cursor: 'pointer',
      padding: theme.spacing(2)
    },
    lotTable: {
      marginTop: theme.spacing(2)
    },
    symbolChip: {
      fontWeight: 'bold',
      fontSize: '1.1rem',
      marginRight: theme.spacing(2)
    },
    actionButtons: {
      display: 'flex',
      gap: theme.spacing(1)
    },
    addButton: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2)
    },
    taxSummary: {
      marginTop: theme.spacing(3),
      padding: theme.spacing(2),
      backgroundColor: theme.palette.background.default
    },
    methodSelector: {
      minWidth: 200
    },
    noHoldings: {
      textAlign: 'center',
      padding: theme.spacing(4)
    }
  })
)

// Mock portfolio for development - in production this would come from Redux
const createEmptyPortfolio = (): CostBasisPortfolio<Date> => ({
  investments: [],
  defaultMethod: CostBasisMethod.FIFO,
  lastUpdated: new Date()
})

const CostBasisTracker = (): ReactElement => {
  const classes = useStyles()
  useMediaQuery('(prefers-color-scheme: dark)') // For theme-aware styling
  const year = useSelector((state: YearsTaxesState) => state.activeYear)
  const taxYear = TaxYears[year]

  const { navButtons } = usePager()

  // State for portfolio - in production, this would be from Redux
  const [portfolio, setPortfolio] = useState<CostBasisPortfolio<Date>>(
    createEmptyPortfolio()
  )
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(
    new Set()
  )
  const [editorOpen, setEditorOpen] = useState(false)
  const [selectedInvestment, setSelectedInvestment] = useState<
    Investment<Date> | undefined
  >()
  const [isNewPosition, setIsNewPosition] = useState(false)

  // Calculate tax year summary
  const taxSummary = useMemo(() => {
    const allTransactions = portfolio.investments.flatMap((i) => i.transactions)
    return calculateGainLossSummary(allTransactions, taxYear)
  }, [portfolio, taxYear])

  // Calculate total portfolio value and unrealized gains
  const portfolioSummary = useMemo(() => {
    let totalCostBasis = 0
    let totalMarketValue = 0
    let totalUnrealizedGain = 0

    for (const investment of portfolio.investments) {
      totalCostBasis += investment.totalCostBasis
      if (investment.currentPrice) {
        const marketValue = investment.totalShares * investment.currentPrice
        totalMarketValue += marketValue
        totalUnrealizedGain += investment.unrealizedGainLoss ?? 0
      }
    }

    return {
      totalCostBasis,
      totalMarketValue,
      totalUnrealizedGain
    }
  }, [portfolio])

  const togglePosition = (symbol: string) => {
    setExpandedPositions((prev) => {
      const next = new Set(prev)
      if (next.has(symbol)) {
        next.delete(symbol)
      } else {
        next.add(symbol)
      }
      return next
    })
  }

  const handleAddPosition = () => {
    setSelectedInvestment(undefined)
    setIsNewPosition(true)
    setEditorOpen(true)
  }

  const handleEditPosition = (investment: Investment<Date>) => {
    setSelectedInvestment(investment)
    setIsNewPosition(false)
    setEditorOpen(true)
  }

  const handleSaveBuy = (transaction: StockTransaction<Date>) => {
    setPortfolio((prev) => processBuyTransaction(prev, transaction))
  }

  const handleSaveSell = (
    transaction: StockTransaction<Date>,
    lotSelections: TaxLotSelection[],
    method: CostBasisMethod
  ) => {
    setPortfolio((prev) =>
      processSellTransaction(prev, transaction, lotSelections, method)
    )
  }

  const handleSaveDividendReinvestment = (
    transaction: StockTransaction<Date>
  ) => {
    setPortfolio((prev) => processBuyTransaction(prev, transaction))
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSaveSplit = (symbol: string, splitRatio: number, _date: Date) => {
    setPortfolio((prev) => {
      const investmentIndex = prev.investments.findIndex(
        (i) => i.symbol === symbol
      )
      if (investmentIndex < 0) return prev

      const investment = prev.investments[investmentIndex]
      const updatedLots = applyStockSplit(investment.lots, symbol, splitRatio)
      const updatedInvestment = createInvestment(
        symbol,
        updatedLots,
        investment.transactions,
        investment.isMutualFund,
        investment.name,
        investment.currentPrice
          ? investment.currentPrice / splitRatio
          : undefined
      )

      const updatedInvestments = [...prev.investments]
      updatedInvestments[investmentIndex] = updatedInvestment

      return {
        ...prev,
        investments: updatedInvestments,
        lastUpdated: new Date()
      }
    })
  }

  const handleDeletePosition = (symbol: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete all holdings for ${symbol}?`
      )
    ) {
      setPortfolio((prev) => ({
        ...prev,
        investments: prev.investments.filter((i) => i.symbol !== symbol),
        lastUpdated: new Date()
      }))
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getAllRecentTransactions = (): StockTransaction<Date>[] => {
    return portfolio.investments.flatMap((i) => i.transactions)
  }

  return (
    <>
      <Helmet>
        <title>Cost Basis Tracker | Investments | UsTaxes.org</title>
      </Helmet>

      <h2>Cost Basis Tracker</h2>
      <Typography variant="body1" paragraph>
        Track your investment positions and tax lots for accurate capital gains
        reporting on Form 8949 and Schedule D.
      </Typography>

      {/* Portfolio Summary Cards */}
      <Grid container spacing={2} className={classes.summaryCard}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="textSecondary">
                Total Cost Basis
              </Typography>
              <Typography variant="h5">
                <Currency value={portfolioSummary.totalCostBasis} plain />
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="textSecondary">
                Total Market Value
              </Typography>
              <Typography variant="h5">
                <Currency value={portfolioSummary.totalMarketValue} plain />
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="textSecondary">
                Unrealized Gain/Loss
              </Typography>
              <Typography
                variant="h5"
                className={
                  portfolioSummary.totalUnrealizedGain >= 0
                    ? classes.gain
                    : classes.loss
                }
              >
                {portfolioSummary.totalUnrealizedGain >= 0 ? (
                  <TrendingUp
                    style={{ verticalAlign: 'middle', marginRight: 8 }}
                  />
                ) : (
                  <TrendingDown
                    style={{ verticalAlign: 'middle', marginRight: 8 }}
                  />
                )}
                <Currency value={portfolioSummary.totalUnrealizedGain} />
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Add Position Button */}
      <Button
        variant="contained"
        color="primary"
        startIcon={<Add />}
        onClick={handleAddPosition}
        className={classes.addButton}
      >
        Add New Position
      </Button>

      {/* Holdings List */}
      {portfolio.investments.length === 0 ? (
        <Paper className={classes.noHoldings}>
          <AccountBalance style={{ fontSize: 64, color: 'gray' }} />
          <Typography variant="h6" color="textSecondary">
            No positions yet
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Add your first position to start tracking cost basis
          </Typography>
        </Paper>
      ) : (
        portfolio.investments.map((investment) => {
          const isExpanded = expandedPositions.has(investment.symbol)

          return (
            <Paper key={investment.symbol} className={classes.positionCard}>
              <div
                className={classes.positionHeader}
                onClick={() => togglePosition(investment.symbol)}
              >
                <Box display="flex" alignItems="center">
                  <Typography className={classes.symbolChip}>
                    {investment.symbol}
                  </Typography>
                  {investment.name && (
                    <Typography variant="body2" color="textSecondary">
                      {investment.name}
                    </Typography>
                  )}
                </Box>
                <Box display="flex" alignItems="center">
                  <Box mr={4}>
                    <Typography variant="body2" color="textSecondary">
                      Shares
                    </Typography>
                    <Typography variant="body1">
                      {investment.totalShares.toFixed(4)}
                    </Typography>
                  </Box>
                  <Box mr={4}>
                    <Typography variant="body2" color="textSecondary">
                      Cost Basis
                    </Typography>
                    <Typography variant="body1">
                      <Currency value={investment.totalCostBasis} plain />
                    </Typography>
                  </Box>
                  <Box mr={4}>
                    <Typography variant="body2" color="textSecondary">
                      Avg Cost/Share
                    </Typography>
                    <Typography variant="body1">
                      <Currency value={investment.averageCostPerShare} plain />
                    </Typography>
                  </Box>
                  {investment.unrealizedGainLoss !== undefined && (
                    <Box mr={4}>
                      <Typography variant="body2" color="textSecondary">
                        Unrealized G/L
                      </Typography>
                      <Typography
                        variant="body1"
                        className={
                          investment.unrealizedGainLoss >= 0
                            ? classes.gain
                            : classes.loss
                        }
                      >
                        <Currency value={investment.unrealizedGainLoss} />
                      </Typography>
                    </Box>
                  )}
                  <div className={classes.actionButtons}>
                    <Tooltip title="Edit Position">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditPosition(investment)
                        }}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Position">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeletePosition(investment.symbol)
                        }}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                  </div>
                </Box>
              </div>

              <Collapse in={isExpanded}>
                <Box p={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Tax Lots
                  </Typography>
                  <TableContainer className={classes.lotTable}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Purchase Date</TableCell>
                          <TableCell align="right">Original Shares</TableCell>
                          <TableCell align="right">Remaining Shares</TableCell>
                          <TableCell align="right">Cost/Share</TableCell>
                          <TableCell align="right">Total Cost Basis</TableCell>
                          <TableCell align="right">Wash Sale Adj.</TableCell>
                          <TableCell>Holding Period</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {investment.lots
                          .filter((lot) => lot.remainingShares > 0)
                          .map((lot) => {
                            const daysHeld = Math.floor(
                              (new Date().getTime() -
                                lot.purchaseDate.getTime()) /
                                (1000 * 60 * 60 * 24)
                            )
                            const isLongTerm = daysHeld > 365

                            return (
                              <TableRow key={lot.id}>
                                <TableCell>
                                  {formatDate(lot.purchaseDate)}
                                </TableCell>
                                <TableCell align="right">
                                  {lot.shares.toFixed(4)}
                                </TableCell>
                                <TableCell align="right">
                                  {lot.remainingShares.toFixed(4)}
                                </TableCell>
                                <TableCell align="right">
                                  <Currency
                                    value={lot.adjustedCostBasis / lot.shares}
                                    plain
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  <Currency
                                    value={
                                      (lot.adjustedCostBasis *
                                        lot.remainingShares) /
                                      lot.shares
                                    }
                                    plain
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  {lot.washSaleAdjustment > 0 ? (
                                    <Currency
                                      value={lot.washSaleAdjustment}
                                      plain
                                    />
                                  ) : (
                                    '-'
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={
                                      isLongTerm ? classes.gain : classes.loss
                                    }
                                  >
                                    {isLongTerm ? 'Long-term' : 'Short-term'}
                                  </span>
                                  <Typography variant="caption" display="block">
                                    {daysHeld} days
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Closed Lots (Sold) */}
                  {investment.lots.some((l) => l.remainingShares === 0) && (
                    <>
                      <Typography
                        variant="subtitle2"
                        gutterBottom
                        style={{ marginTop: 16 }}
                      >
                        Closed Lots (Sold)
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Purchase Date</TableCell>
                              <TableCell align="right">Shares</TableCell>
                              <TableCell align="right">Cost Basis</TableCell>
                              <TableCell align="right">
                                Wash Sale Adj.
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {investment.lots
                              .filter((lot) => lot.remainingShares === 0)
                              .map((lot) => (
                                <TableRow key={lot.id}>
                                  <TableCell>
                                    {formatDate(lot.purchaseDate)}
                                  </TableCell>
                                  <TableCell align="right">
                                    {lot.shares.toFixed(4)}
                                  </TableCell>
                                  <TableCell align="right">
                                    <Currency value={lot.totalCost} plain />
                                  </TableCell>
                                  <TableCell align="right">
                                    {lot.washSaleAdjustment > 0 ? (
                                      <Currency
                                        value={lot.washSaleAdjustment}
                                        plain
                                      />
                                    ) : (
                                      '-'
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  )}
                </Box>
              </Collapse>
            </Paper>
          )
        })
      )}

      {/* Tax Year Summary */}
      {(taxSummary.shortTermGainLoss !== 0 ||
        taxSummary.longTermGainLoss !== 0) && (
        <Paper className={classes.taxSummary}>
          <Typography variant="h6" gutterBottom>
            {taxYear} Tax Year Summary (Form 8949 / Schedule D)
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="textSecondary">
                Short-Term Capital Gains/Losses
              </Typography>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell>Proceeds</TableCell>
                    <TableCell align="right">
                      <Currency value={taxSummary.shortTermProceeds} plain />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Cost Basis</TableCell>
                    <TableCell align="right">
                      <Currency value={taxSummary.shortTermCostBasis} plain />
                    </TableCell>
                  </TableRow>
                  {taxSummary.shortTermWashSaleAdjustment > 0 && (
                    <TableRow>
                      <TableCell>Wash Sale Adjustment</TableCell>
                      <TableCell align="right">
                        <Currency
                          value={taxSummary.shortTermWashSaleAdjustment}
                          plain
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell>
                      <strong>Net Short-Term Gain/Loss</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong
                        className={
                          taxSummary.shortTermGainLoss >= 0
                            ? classes.gain
                            : classes.loss
                        }
                      >
                        <Currency value={taxSummary.shortTermGainLoss} />
                      </strong>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="textSecondary">
                Long-Term Capital Gains/Losses
              </Typography>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell>Proceeds</TableCell>
                    <TableCell align="right">
                      <Currency value={taxSummary.longTermProceeds} plain />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Cost Basis</TableCell>
                    <TableCell align="right">
                      <Currency value={taxSummary.longTermCostBasis} plain />
                    </TableCell>
                  </TableRow>
                  {taxSummary.longTermWashSaleAdjustment > 0 && (
                    <TableRow>
                      <TableCell>Wash Sale Adjustment</TableCell>
                      <TableCell align="right">
                        <Currency
                          value={taxSummary.longTermWashSaleAdjustment}
                          plain
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell>
                      <strong>Net Long-Term Gain/Loss</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong
                        className={
                          taxSummary.longTermGainLoss >= 0
                            ? classes.gain
                            : classes.loss
                        }
                      >
                        <Currency value={taxSummary.longTermGainLoss} />
                      </strong>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Position Editor Dialog */}
      <Dialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent>
          <PositionEditor
            investment={selectedInvestment}
            onSaveBuy={handleSaveBuy}
            onSaveSell={handleSaveSell}
            onSaveDividendReinvestment={handleSaveDividendReinvestment}
            onSaveSplit={handleSaveSplit}
            onClose={() => setEditorOpen(false)}
            isNewPosition={isNewPosition}
            recentTransactions={getAllRecentTransactions()}
          />
        </DialogContent>
      </Dialog>

      {navButtons}
    </>
  )
}

export default CostBasisTracker
