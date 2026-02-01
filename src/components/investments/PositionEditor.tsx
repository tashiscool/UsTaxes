/**
 * PositionEditor Component
 *
 * Manages individual investment positions:
 * - Add new purchases
 * - Record sales with lot selection
 * - Handle dividend reinvestment
 * - Process stock splits and mergers
 */

import { ReactElement, useState } from 'react'
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  Grid,
  Paper,
  Radio,
  RadioGroup,
  Tab,
  Tabs,
  Typography,
  useMediaQuery
} from '@material-ui/core'
import { makeStyles, Theme, createStyles } from '@material-ui/core/styles'
import { Alert } from '@material-ui/lab'
import {
  Investment,
  StockTransaction,
  StockTransactionType,
  TaxLotSelection,
  CostBasisMethod
} from 'ustaxes/core/data'
import { LabeledInput } from 'ustaxes/components/input'
import { DatePicker } from 'ustaxes/components/input/DatePicker'
import { Patterns } from 'ustaxes/components/Patterns'
import { FormProvider, useForm } from 'react-hook-form'
import TaxLotSelector from './TaxLotSelector'
import { generateId } from 'ustaxes/core/investments/costBasis'
import { wouldTriggerWashSale } from 'ustaxes/core/investments/washSale'
import { intentionallyFloat } from 'ustaxes/core/util'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      padding: theme.spacing(2)
    },
    formSection: {
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2)
    },
    tabContent: {
      padding: theme.spacing(2)
    },
    splitInfo: {
      marginTop: theme.spacing(1),
      padding: theme.spacing(1),
      backgroundColor: theme.palette.background.default
    },
    warningBox: {
      marginTop: theme.spacing(2)
    }
  })
)

// Form types for different transaction types
interface BuyFormData {
  symbol: string
  date: Date
  shares: string
  pricePerShare: string
  fees: string
  notes?: string
}

interface SellFormData {
  date: Date
  shares: string
  pricePerShare: string
  fees: string
  notes?: string
}

interface DividendFormData {
  date: Date
  shares: string
  pricePerShare: string
  dividendAmount: string
}

interface SplitFormData {
  date: Date
  splitType: 'forward' | 'reverse'
  ratio: string
}

interface MergerFormData {
  date: Date
  newSymbol: string
  conversionRatio: string
  cashReceived: string
}

interface PositionEditorProps {
  investment?: Investment<Date>
  onSaveBuy: (transaction: StockTransaction<Date>) => void
  onSaveSell: (
    transaction: StockTransaction<Date>,
    lotSelections: TaxLotSelection[],
    method: CostBasisMethod
  ) => void
  onSaveDividendReinvestment: (transaction: StockTransaction<Date>) => void
  onSaveSplit: (symbol: string, splitRatio: number, date: Date) => void
  onSaveMerger?: (
    oldSymbol: string,
    newSymbol: string,
    ratio: number,
    cashReceived: number,
    date: Date
  ) => void
  onClose: () => void
  isNewPosition?: boolean
  recentTransactions?: StockTransaction<Date>[]
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel = ({ children, value, index }: TabPanelProps): ReactElement => {
  return (
    <div hidden={value !== index}>
      {value === index && <Box p={2}>{children}</Box>}
    </div>
  )
}

const PositionEditor = ({
  investment,
  onSaveBuy,
  onSaveSell,
  onSaveDividendReinvestment,
  onSaveSplit,
  onSaveMerger,
  onClose,
  isNewPosition = false,
  recentTransactions = []
}: PositionEditorProps): ReactElement => {
  const classes = useStyles()
  useMediaQuery('(prefers-color-scheme: dark)') // For theme-aware styling

  const [tabValue, setTabValue] = useState(isNewPosition ? 0 : 0)
  const [showLotSelector, setShowLotSelector] = useState(false)
  const [pendingSale, setPendingSale] = useState<SellFormData | null>(null)
  const [selectedLots, setSelectedLots] = useState<TaxLotSelection[]>([])
  const [selectedMethod, setSelectedMethod] = useState<CostBasisMethod>(
    investment?.defaultCostBasisMethod ?? CostBasisMethod.FIFO
  )

  // Form methods for each transaction type
  const buyMethods = useForm<BuyFormData>({
    defaultValues: {
      symbol: investment?.symbol ?? '',
      date: new Date(),
      shares: '',
      pricePerShare: '',
      fees: '0',
      notes: ''
    }
  })

  const sellMethods = useForm<SellFormData>({
    defaultValues: {
      date: new Date(),
      shares: '',
      pricePerShare: '',
      fees: '0',
      notes: ''
    }
  })

  const dividendMethods = useForm<DividendFormData>({
    defaultValues: {
      date: new Date(),
      shares: '',
      pricePerShare: '',
      dividendAmount: ''
    }
  })

  const splitMethods = useForm<SplitFormData>({
    defaultValues: {
      date: new Date(),
      splitType: 'forward',
      ratio: '2'
    }
  })

  const mergerMethods = useForm<MergerFormData>({
    defaultValues: {
      date: new Date(),
      newSymbol: '',
      conversionRatio: '1',
      cashReceived: '0'
    }
  })

  const handleTabChange = (
    _event: React.ChangeEvent<unknown>,
    newValue: number
  ) => {
    setTabValue(newValue)
  }

  // Check for potential wash sale when adding a purchase
  const watchBuyDate = buyMethods.watch('date')
  const watchBuySymbol = buyMethods.watch('symbol')
  const washSaleWarning = wouldTriggerWashSale(
    watchBuySymbol || investment?.symbol || '',
    watchBuyDate || new Date(),
    recentTransactions
  )

  const handleBuySubmit = (data: BuyFormData): void => {
    const transaction: StockTransaction<Date> = {
      id: generateId(),
      symbol: data.symbol || investment?.symbol || '',
      transactionType: StockTransactionType.Buy,
      date: data.date,
      shares: parseFloat(data.shares),
      pricePerShare: parseFloat(data.pricePerShare),
      fees: parseFloat(data.fees) || 0,
      notes: data.notes
    }
    onSaveBuy(transaction)
    buyMethods.reset()
    onClose()
  }

  const handleSellInitiate = (data: SellFormData): void => {
    setPendingSale(data)
    setShowLotSelector(true)
  }

  const handleLotSelectionChange = (
    selections: TaxLotSelection[],
    method: CostBasisMethod
  ): void => {
    setSelectedLots(selections)
    setSelectedMethod(method)
  }

  const handleSellConfirm = (): void => {
    if (!pendingSale || !investment) return

    const shares = parseFloat(pendingSale.shares)
    const pricePerShare = parseFloat(pendingSale.pricePerShare)
    const fees = parseFloat(pendingSale.fees) || 0

    const transaction: StockTransaction<Date> = {
      id: generateId(),
      symbol: investment.symbol,
      transactionType: StockTransactionType.Sell,
      date: pendingSale.date,
      shares,
      pricePerShare,
      fees,
      proceeds: shares * pricePerShare - fees,
      notes: pendingSale.notes
    }

    onSaveSell(transaction, selectedLots, selectedMethod)
    sellMethods.reset()
    setPendingSale(null)
    setShowLotSelector(false)
    onClose()
  }

  const handleDividendSubmit = (data: DividendFormData): void => {
    if (!investment) return

    const transaction: StockTransaction<Date> = {
      id: generateId(),
      symbol: investment.symbol,
      transactionType: StockTransactionType.DividendReinvestment,
      date: data.date,
      shares: parseFloat(data.shares),
      pricePerShare: parseFloat(data.pricePerShare),
      fees: 0
    }
    onSaveDividendReinvestment(transaction)
    dividendMethods.reset()
    onClose()
  }

  const handleSplitSubmit = (data: SplitFormData): void => {
    if (!investment) return

    const ratio = parseFloat(data.ratio)
    const effectiveRatio = data.splitType === 'forward' ? ratio : 1 / ratio
    onSaveSplit(investment.symbol, effectiveRatio, data.date)
    splitMethods.reset()
    onClose()
  }

  const handleMergerSubmit = (data: MergerFormData): void => {
    if (!investment || !onSaveMerger) return

    onSaveMerger(
      investment.symbol,
      data.newSymbol,
      parseFloat(data.conversionRatio),
      parseFloat(data.cashReceived) || 0,
      data.date
    )
    mergerMethods.reset()
    onClose()
  }

  const availableShares = investment?.totalShares ?? 0

  return (
    <Paper className={classes.root}>
      <Typography variant="h6" gutterBottom>
        {isNewPosition
          ? 'Add New Position'
          : `Manage ${investment?.symbol ?? 'Position'}`}
      </Typography>

      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        indicatorColor="primary"
        textColor="primary"
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label="Buy" />
        {!isNewPosition && <Tab label="Sell" disabled={availableShares <= 0} />}
        {!isNewPosition && <Tab label="Dividend Reinvestment" />}
        {!isNewPosition && <Tab label="Stock Split" />}
        {!isNewPosition && onSaveMerger && <Tab label="Merger/Acquisition" />}
      </Tabs>

      {/* Buy Tab */}
      <TabPanel value={tabValue} index={0}>
        <FormProvider {...buyMethods}>
          <form
            onSubmit={intentionallyFloat(
              buyMethods.handleSubmit(handleBuySubmit)
            )}
          >
            <Grid container spacing={2}>
              {isNewPosition && (
                <Grid item xs={12} sm={6}>
                  <LabeledInput label="Symbol" name="symbol" required />
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="Purchase Date"
                  name="date"
                  maxDate={new Date()}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <LabeledInput
                  label="Number of Shares"
                  name="shares"
                  patternConfig={Patterns.number}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <LabeledInput
                  label="Price Per Share"
                  name="pricePerShare"
                  patternConfig={Patterns.currency}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <LabeledInput
                  label="Fees/Commission"
                  name="fees"
                  patternConfig={Patterns.currency}
                />
              </Grid>
              <Grid item xs={12}>
                <LabeledInput label="Notes" name="notes" />
              </Grid>
            </Grid>

            {washSaleWarning.wouldTrigger && (
              <Alert severity="warning" className={classes.warningBox}>
                <Typography variant="body2">
                  <strong>Potential Wash Sale Warning:</strong> This purchase is
                  within 30 days of a sale at a loss for the same security. The
                  loss from the previous sale may be disallowed and added to the
                  cost basis of these shares.
                </Typography>
              </Alert>
            )}

            <Box mt={2} display="flex" justifyContent="flex-end">
              <Button onClick={onClose} style={{ marginRight: 8 }}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" color="primary">
                Add Purchase
              </Button>
            </Box>
          </form>
        </FormProvider>
      </TabPanel>

      {/* Sell Tab */}
      {!isNewPosition && (
        <TabPanel value={tabValue} index={1}>
          {!showLotSelector ? (
            <FormProvider {...sellMethods}>
              <form
                onSubmit={intentionallyFloat(
                  sellMethods.handleSubmit(handleSellInitiate)
                )}
              >
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">
                      Available shares: {availableShares.toFixed(4)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <DatePicker
                      label="Sale Date"
                      name="date"
                      maxDate={new Date()}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <LabeledInput
                      label="Number of Shares"
                      name="shares"
                      patternConfig={Patterns.number}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <LabeledInput
                      label="Sale Price Per Share"
                      name="pricePerShare"
                      patternConfig={Patterns.currency}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <LabeledInput
                      label="Fees/Commission"
                      name="fees"
                      patternConfig={Patterns.currency}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <LabeledInput label="Notes" name="notes" />
                  </Grid>
                </Grid>

                <Box mt={2} display="flex" justifyContent="flex-end">
                  <Button onClick={onClose} style={{ marginRight: 8 }}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="contained" color="primary">
                    Select Tax Lots
                  </Button>
                </Box>
              </form>
            </FormProvider>
          ) : (
            <>
              <TaxLotSelector
                lots={investment?.lots ?? []}
                sharesToSell={parseFloat(pendingSale?.shares ?? '0')}
                currentPrice={parseFloat(pendingSale?.pricePerShare ?? '0')}
                saleDate={pendingSale?.date}
                onSelectionChange={handleLotSelectionChange}
                defaultMethod={investment?.defaultCostBasisMethod}
                isMutualFund={investment?.isMutualFund}
              />

              <Box mt={2} display="flex" justifyContent="flex-end">
                <Button
                  onClick={() => setShowLotSelector(false)}
                  style={{ marginRight: 8 }}
                >
                  Back
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSellConfirm}
                >
                  Confirm Sale
                </Button>
              </Box>
            </>
          )}
        </TabPanel>
      )}

      {/* Dividend Reinvestment Tab */}
      {!isNewPosition && (
        <TabPanel value={tabValue} index={2}>
          <FormProvider {...dividendMethods}>
            <form
              onSubmit={intentionallyFloat(
                dividendMethods.handleSubmit(handleDividendSubmit)
              )}
            >
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <DatePicker
                    label="Reinvestment Date"
                    name="date"
                    maxDate={new Date()}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <LabeledInput
                    label="Dividend Amount"
                    name="dividendAmount"
                    patternConfig={Patterns.currency}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <LabeledInput
                    label="Shares Purchased"
                    name="shares"
                    patternConfig={Patterns.number}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <LabeledInput
                    label="Price Per Share"
                    name="pricePerShare"
                    patternConfig={Patterns.currency}
                    required
                  />
                </Grid>
              </Grid>

              <Box mt={2} display="flex" justifyContent="flex-end">
                <Button onClick={onClose} style={{ marginRight: 8 }}>
                  Cancel
                </Button>
                <Button type="submit" variant="contained" color="primary">
                  Record Reinvestment
                </Button>
              </Box>
            </form>
          </FormProvider>
        </TabPanel>
      )}

      {/* Stock Split Tab */}
      {!isNewPosition && (
        <TabPanel value={tabValue} index={3}>
          <FormProvider {...splitMethods}>
            <form
              onSubmit={intentionallyFloat(
                splitMethods.handleSubmit(handleSplitSubmit)
              )}
            >
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <DatePicker
                    label="Split Date"
                    name="date"
                    maxDate={new Date()}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl component="fieldset">
                    <RadioGroup
                      row
                      name="splitType"
                      value={splitMethods.watch('splitType')}
                      onChange={(e) =>
                        splitMethods.setValue(
                          'splitType',
                          e.target.value as 'forward' | 'reverse'
                        )
                      }
                    >
                      <FormControlLabel
                        value="forward"
                        control={<Radio />}
                        label="Forward Split"
                      />
                      <FormControlLabel
                        value="reverse"
                        control={<Radio />}
                        label="Reverse Split"
                      />
                    </RadioGroup>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <LabeledInput
                    label="Split Ratio (e.g., 2 for 2:1)"
                    name="ratio"
                    patternConfig={Patterns.number}
                    required
                  />
                </Grid>
              </Grid>

              <Paper className={classes.splitInfo} elevation={0}>
                <Typography variant="body2">
                  {splitMethods.watch('splitType') === 'forward' ? (
                    <>
                      <strong>Forward Split:</strong> Your{' '}
                      {availableShares.toFixed(4)} shares will become{' '}
                      {(
                        availableShares *
                        parseFloat(splitMethods.watch('ratio') || '1')
                      ).toFixed(4)}{' '}
                      shares. The cost per share will be divided by{' '}
                      {splitMethods.watch('ratio') || '1'}.
                    </>
                  ) : (
                    <>
                      <strong>Reverse Split:</strong> Your{' '}
                      {availableShares.toFixed(4)} shares will become{' '}
                      {(
                        availableShares /
                        parseFloat(splitMethods.watch('ratio') || '1')
                      ).toFixed(4)}{' '}
                      shares. The cost per share will be multiplied by{' '}
                      {splitMethods.watch('ratio') || '1'}.
                    </>
                  )}
                </Typography>
              </Paper>

              <Box mt={2} display="flex" justifyContent="flex-end">
                <Button onClick={onClose} style={{ marginRight: 8 }}>
                  Cancel
                </Button>
                <Button type="submit" variant="contained" color="primary">
                  Apply Split
                </Button>
              </Box>
            </form>
          </FormProvider>
        </TabPanel>
      )}

      {/* Merger Tab */}
      {!isNewPosition && onSaveMerger && (
        <TabPanel value={tabValue} index={4}>
          <FormProvider {...mergerMethods}>
            <form
              onSubmit={intentionallyFloat(
                mergerMethods.handleSubmit(handleMergerSubmit)
              )}
            >
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Alert severity="info">
                    Record a merger or acquisition where your shares of{' '}
                    {investment?.symbol} are converted to shares of another
                    company.
                  </Alert>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DatePicker
                    label="Merger Date"
                    name="date"
                    maxDate={new Date()}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <LabeledInput label="New Symbol" name="newSymbol" required />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <LabeledInput
                    label="Conversion Ratio (new shares per old share)"
                    name="conversionRatio"
                    patternConfig={Patterns.number}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <LabeledInput
                    label="Cash Received (if any)"
                    name="cashReceived"
                    patternConfig={Patterns.currency}
                  />
                </Grid>
              </Grid>

              <Paper className={classes.splitInfo} elevation={0}>
                <Typography variant="body2">
                  Your {availableShares.toFixed(4)} shares of{' '}
                  {investment?.symbol} will become{' '}
                  {(
                    availableShares *
                    parseFloat(mergerMethods.watch('conversionRatio') || '1')
                  ).toFixed(4)}{' '}
                  shares of {mergerMethods.watch('newSymbol') || '[NEW SYMBOL]'}
                  .
                  {parseFloat(mergerMethods.watch('cashReceived') || '0') >
                    0 && (
                    <>
                      {' '}
                      You will also receive $
                      {mergerMethods.watch('cashReceived')} in cash, which may
                      be taxable.
                    </>
                  )}
                </Typography>
              </Paper>

              <Box mt={2} display="flex" justifyContent="flex-end">
                <Button onClick={onClose} style={{ marginRight: 8 }}>
                  Cancel
                </Button>
                <Button type="submit" variant="contained" color="primary">
                  Record Merger
                </Button>
              </Box>
            </form>
          </FormProvider>
        </TabPanel>
      )}
    </Paper>
  )
}

export default PositionEditor
