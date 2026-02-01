/**
 * Cryptocurrency Import Component
 *
 * Provides UI for importing cryptocurrency transactions from:
 * - Coinbase
 * - Kraken
 * - Generic (user-defined column mapping)
 *
 * Features:
 * - Exchange selector with auto-detection
 * - File upload for CSV imports
 * - Transaction preview with filtering
 * - Cost basis method selection (FIFO, LIFO, HIFO, Specific ID)
 * - Import to Form 8949
 */

import { ReactElement, useState, useMemo } from 'react'
import {
  Button,
  Grid,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  TextField,
  Chip,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormHelperText,
  Tabs,
  Tab,
  Tooltip
} from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import InfoIcon from '@material-ui/icons/Info'
import { makeStyles, createStyles, Theme } from '@material-ui/core/styles'
import { useDispatch } from 'ustaxes/redux'
import * as actions from 'ustaxes/redux/actions'
import { LoadRaw } from 'ustaxes/redux/fs/Load'
import {
  BrokerageTransaction,
  transactionsToAssets,
  ParseResult
} from 'ustaxes/core/import/brokerageParser'
import { CoinbaseParser } from 'ustaxes/core/import/parsers/coinbase'
import { KrakenParser } from 'ustaxes/core/import/parsers/kraken'
import {
  GenericCryptoParser,
  CryptoColumnMapping,
  CRYPTO_FIELDS
} from 'ustaxes/core/import/parsers/generic-crypto'
import {
  CostBasisMethod,
  CryptoTransaction,
  calculateCryptoIncome
} from 'ustaxes/core/import/parsers/cryptoTypes'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      padding: theme.spacing(2)
    },
    section: {
      marginBottom: theme.spacing(3)
    },
    tableContainer: {
      maxHeight: 400,
      marginTop: theme.spacing(2)
    },
    chip: {
      marginRight: theme.spacing(0.5),
      marginBottom: theme.spacing(0.5)
    },
    shortTerm: {
      backgroundColor: theme.palette.warning.light
    },
    longTerm: {
      backgroundColor: theme.palette.success.light
    },
    income: {
      backgroundColor: theme.palette.info.light
    },
    gain: {
      color: theme.palette.success.dark
    },
    loss: {
      color: theme.palette.error.dark
    },
    summaryBox: {
      padding: theme.spacing(2),
      marginTop: theme.spacing(2)
    },
    buttonGroup: {
      marginTop: theme.spacing(2),
      '& > *': {
        marginRight: theme.spacing(1)
      }
    },
    columnSelect: {
      minWidth: 120
    },
    previewCell: {
      maxWidth: 150,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    },
    infoIcon: {
      marginLeft: theme.spacing(0.5),
      fontSize: '1rem',
      verticalAlign: 'middle',
      color: theme.palette.text.secondary
    },
    tabPanel: {
      padding: theme.spacing(2, 0)
    }
  })
)

/**
 * Supported crypto exchanges
 */
type CryptoExchange = 'coinbase' | 'kraken' | 'generic'

/**
 * Cost basis method labels
 */
const COST_BASIS_METHODS: {
  value: CostBasisMethod
  label: string
  description: string
}[] = [
  {
    value: 'fifo',
    label: 'FIFO',
    description: 'First In, First Out - Oldest coins sold first'
  },
  {
    value: 'lifo',
    label: 'LIFO',
    description: 'Last In, First Out - Newest coins sold first'
  },
  {
    value: 'hifo',
    label: 'HIFO',
    description:
      'Highest In, First Out - Highest cost basis sold first (minimizes gains)'
  },
  {
    value: 'spec_id',
    label: 'Specific ID',
    description: 'Manually select which lots to sell'
  }
]

/**
 * Format currency for display
 */
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value)
}

/**
 * Format date for display
 */
const formatDate = (date: Date): string => {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

/**
 * Format crypto quantity
 */
const formatQuantity = (quantity: number): string => {
  if (quantity >= 1) {
    return quantity.toFixed(4)
  }
  return quantity.toFixed(8)
}

interface GenericMappingProps {
  headers: string[]
  columnMapping: CryptoColumnMapping
  onMappingChange: (
    field: keyof CryptoColumnMapping,
    columnIndex: number
  ) => void
  previewRows: string[][]
}

/**
 * Component for generic crypto CSV column mapping
 */
const GenericMappingUI = ({
  headers,
  columnMapping,
  onMappingChange,
  previewRows
}: GenericMappingProps): ReactElement => {
  const classes = useStyles()

  return (
    <Box>
      <Typography variant="subtitle1" gutterBottom>
        Map CSV Columns to Fields
      </Typography>
      <Grid container spacing={2}>
        {CRYPTO_FIELDS.map((field) => (
          <Grid item xs={12} sm={6} md={4} key={field.key}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {field.label}
                {field.required ? ' *' : ''}
              </InputLabel>
              <Select
                value={columnMapping[field.key] ?? -1}
                onChange={(e) =>
                  onMappingChange(field.key, e.target.value as number)
                }
                className={classes.columnSelect}
              >
                <MenuItem value={-1}>-- Not mapped --</MenuItem>
                {headers.map((header, index) => (
                  <MenuItem key={index} value={index}>
                    {header || `Column ${index + 1}`}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{field.description}</FormHelperText>
            </FormControl>
          </Grid>
        ))}
      </Grid>

      {previewRows.length > 0 && (
        <Box mt={2}>
          <Typography variant="subtitle2" gutterBottom>
            Preview (first 3 data rows):
          </Typography>
          <TableContainer component={Paper} className={classes.tableContainer}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {headers.map((header, index) => (
                    <TableCell key={index} className={classes.previewCell}>
                      {header || `Col ${index + 1}`}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {previewRows.slice(1, 4).map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <TableCell
                        key={cellIndex}
                        className={classes.previewCell}
                      >
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  )
}

interface TransactionTableProps {
  transactions: BrokerageTransaction[]
  selectedIndices: Set<number>
  onSelectionChange: (indices: Set<number>) => void
}

/**
 * Table displaying parsed Form 8949 transactions
 */
const TransactionTable = ({
  transactions,
  selectedIndices,
  onSelectionChange
}: TransactionTableProps): ReactElement => {
  const classes = useStyles()

  const toggleAll = () => {
    if (selectedIndices.size === transactions.length) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(transactions.map((_, i) => i)))
    }
  }

  const toggleOne = (index: number) => {
    const newSet = new Set(selectedIndices)
    if (newSet.has(index)) {
      newSet.delete(index)
    } else {
      newSet.add(index)
    }
    onSelectionChange(newSet)
  }

  return (
    <TableContainer component={Paper} className={classes.tableContainer}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                checked={
                  selectedIndices.size === transactions.length &&
                  transactions.length > 0
                }
                indeterminate={
                  selectedIndices.size > 0 &&
                  selectedIndices.size < transactions.length
                }
                onChange={toggleAll}
              />
            </TableCell>
            <TableCell>Asset</TableCell>
            <TableCell>Acquired</TableCell>
            <TableCell>Sold</TableCell>
            <TableCell align="right">Qty</TableCell>
            <TableCell align="right">Proceeds</TableCell>
            <TableCell align="right">Cost Basis</TableCell>
            <TableCell align="right">Gain/Loss</TableCell>
            <TableCell>Term</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((tx, index) => (
            <TableRow
              key={index}
              selected={selectedIndices.has(index)}
              hover
              onClick={() => toggleOne(index)}
            >
              <TableCell padding="checkbox">
                <Checkbox checked={selectedIndices.has(index)} />
              </TableCell>
              <TableCell>
                <strong>{tx.symbol}</strong>
              </TableCell>
              <TableCell>{formatDate(tx.dateAcquired)}</TableCell>
              <TableCell>{formatDate(tx.dateSold)}</TableCell>
              <TableCell align="right">
                {formatQuantity(tx.quantity ?? 0)}
              </TableCell>
              <TableCell align="right">{formatCurrency(tx.proceeds)}</TableCell>
              <TableCell align="right">
                {formatCurrency(tx.costBasis)}
              </TableCell>
              <TableCell
                align="right"
                className={tx.gainLoss >= 0 ? classes.gain : classes.loss}
              >
                {formatCurrency(tx.gainLoss)}
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={tx.isShortTerm ? 'Short' : 'Long'}
                  className={`${classes.chip} ${
                    tx.isShortTerm ? classes.shortTerm : classes.longTerm
                  }`}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

interface CryptoTransactionTableProps {
  transactions: CryptoTransaction[]
}

/**
 * Table displaying raw crypto transactions (before Form 8949 conversion)
 */
const CryptoTransactionTable = ({
  transactions
}: CryptoTransactionTableProps): ReactElement => {
  const classes = useStyles()

  return (
    <TableContainer component={Paper} className={classes.tableContainer}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Asset</TableCell>
            <TableCell align="right">Quantity</TableCell>
            <TableCell align="right">Price</TableCell>
            <TableCell align="right">Total</TableCell>
            <TableCell align="right">Fees</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((tx, index) => (
            <TableRow key={index}>
              <TableCell>{formatDate(tx.timestamp)}</TableCell>
              <TableCell>
                <Chip size="small" label={tx.type} className={classes.chip} />
              </TableCell>
              <TableCell>
                <strong>{tx.asset}</strong>
              </TableCell>
              <TableCell align="right">{formatQuantity(tx.quantity)}</TableCell>
              <TableCell align="right">
                {formatCurrency(tx.pricePerUnit)}
              </TableCell>
              <TableCell align="right">
                {formatCurrency(tx.totalValue)}
              </TableCell>
              <TableCell align="right">{formatCurrency(tx.fees)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

/**
 * Main Crypto Import Component
 */
export const CryptoImport = (): ReactElement => {
  const classes = useStyles()
  const dispatch = useDispatch()

  // State
  const [selectedExchange, setSelectedExchange] = useState<CryptoExchange | ''>(
    ''
  )
  const [costBasisMethod, setCostBasisMethod] =
    useState<CostBasisMethod>('fifo')
  const [csvContent, setCsvContent] = useState<string>('')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [cryptoTransactions, setCryptoTransactions] = useState<
    CryptoTransaction[]
  >([])
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(
    new Set()
  )
  const [skipHeaderRows, setSkipHeaderRows] = useState<number>(1)
  const [exchangeName, setExchangeName] = useState<string>('')
  const [importSuccess, setImportSuccess] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<number>(0)

  // Generic mapping state
  const [columnMapping, setColumnMapping] = useState<CryptoColumnMapping>({
    timestamp: -1,
    transactionType: -1,
    asset: -1,
    quantity: -1
  })

  // Parsed CSV data for generic mapping
  const csvData = useMemo(() => {
    if (!csvContent) return { headers: [], rows: [] }

    const lines = csvContent.split('\n').filter((line) => line.trim())
    if (lines.length === 0) return { headers: [], rows: [] }

    const parseRow = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false

      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    const headers = parseRow(lines[0])
    const rows = lines.map(parseRow)

    return { headers, rows }
  }, [csvContent])

  // Summary calculations
  const summary = useMemo(() => {
    if (!parseResult || parseResult.transactions.length === 0) {
      return null
    }

    const selected = parseResult.transactions.filter((_, i) =>
      selectedTransactions.has(i)
    )
    const txs = selected.length > 0 ? selected : parseResult.transactions

    const shortTermGain = txs
      .filter((tx) => tx.isShortTerm && tx.gainLoss > 0)
      .reduce((sum, tx) => sum + tx.gainLoss, 0)

    const shortTermLoss = txs
      .filter((tx) => tx.isShortTerm && tx.gainLoss < 0)
      .reduce((sum, tx) => sum + tx.gainLoss, 0)

    const longTermGain = txs
      .filter((tx) => !tx.isShortTerm && tx.gainLoss > 0)
      .reduce((sum, tx) => sum + tx.gainLoss, 0)

    const longTermLoss = txs
      .filter((tx) => !tx.isShortTerm && tx.gainLoss < 0)
      .reduce((sum, tx) => sum + tx.gainLoss, 0)

    // Calculate income from crypto transactions
    const income = calculateCryptoIncome(cryptoTransactions)

    return {
      totalTransactions: txs.length,
      shortTermGain,
      shortTermLoss,
      shortTermNet: shortTermGain + shortTermLoss,
      longTermGain,
      longTermLoss,
      longTermNet: longTermGain + longTermLoss,
      totalNet: shortTermGain + shortTermLoss + longTermGain + longTermLoss,
      income
    }
  }, [parseResult, selectedTransactions, cryptoTransactions])

  /**
   * Auto-detect exchange from CSV content
   */
  const detectExchange = (content: string): CryptoExchange | null => {
    const lower = content.toLowerCase()
    const firstLine = lower.split('\n')[0] || ''

    if (
      lower.includes('coinbase') ||
      firstLine.includes('spot price at transaction')
    ) {
      return 'coinbase'
    }
    if (
      lower.includes('kraken') ||
      firstLine.includes('refid') ||
      firstLine.includes('aclass')
    ) {
      return 'kraken'
    }

    return null
  }

  /**
   * Handle CSV file load
   */
  const handleFileLoad = (content: string) => {
    setCsvContent(content)
    setParseResult(null)
    setCryptoTransactions([])
    setSelectedTransactions(new Set())
    setImportSuccess(false)
    setActiveTab(0)

    // Auto-detect exchange
    const detected = detectExchange(content)
    if (detected) {
      setSelectedExchange(detected)
      // Auto-parse if exchange detected
      parseContent(content, detected, costBasisMethod)
    }
  }

  /**
   * Parse content with selected exchange
   */
  const parseContent = (
    content: string,
    exchange: CryptoExchange,
    method: CostBasisMethod
  ) => {
    let parser: CoinbaseParser | KrakenParser | GenericCryptoParser
    let cryptoTxs: CryptoTransaction[] = []

    switch (exchange) {
      case 'coinbase':
        parser = new CoinbaseParser(method)
        cryptoTxs = parser.parseCryptoTransactions(content).transactions
        break
      case 'kraken':
        parser = new KrakenParser(method)
        cryptoTxs = parser.parseCryptoTransactions(content).transactions
        break
      case 'generic':
        parser = new GenericCryptoParser({
          columnMapping,
          skipHeaderRows,
          costBasisMethod: method,
          exchangeName: exchangeName || 'Unknown Exchange'
        })
        cryptoTxs = parser.parseCryptoTransactions(content).transactions
        break
      default:
        return
    }

    const result = parser.parse(content)
    setCryptoTransactions(cryptoTxs)
    setParseResult(result)

    if (result.transactions.length > 0) {
      setSelectedTransactions(new Set(result.transactions.map((_, i) => i)))
    }
  }

  /**
   * Handle parse button click
   */
  const handleParse = () => {
    if (!csvContent || !selectedExchange) return
    parseContent(csvContent, selectedExchange, costBasisMethod)
  }

  /**
   * Handle cost basis method change
   */
  const handleCostBasisChange = (method: CostBasisMethod) => {
    setCostBasisMethod(method)
    if (csvContent && selectedExchange) {
      parseContent(csvContent, selectedExchange, method)
    }
  }

  /**
   * Import selected transactions
   */
  const handleImport = () => {
    if (!parseResult || !selectedExchange) return

    const toImport = parseResult.transactions.filter((_, i) =>
      selectedTransactions.has(i)
    )
    if (toImport.length === 0) return

    const assets = transactionsToAssets(toImport)
    dispatch(
      actions.importBrokerageTransactions({
        brokerageType: `crypto-${selectedExchange}`,
        transactions: assets
      })
    )

    setImportSuccess(true)
    setCsvContent('')
    setParseResult(null)
    setCryptoTransactions([])
    setSelectedTransactions(new Set())
    setSelectedExchange('')
  }

  /**
   * Reset all state
   */
  const handleReset = () => {
    setCsvContent('')
    setParseResult(null)
    setCryptoTransactions([])
    setSelectedTransactions(new Set())
    setSelectedExchange('')
    setImportSuccess(false)
    setActiveTab(0)
    setColumnMapping({
      timestamp: -1,
      transactionType: -1,
      asset: -1,
      quantity: -1
    })
  }

  /**
   * Handle column mapping change
   */
  const handleMappingChange = (
    field: keyof CryptoColumnMapping,
    columnIndex: number
  ) => {
    setColumnMapping((prev) => ({
      ...prev,
      [field]: columnIndex
    }))
  }

  const isMappingValid =
    columnMapping.timestamp >= 0 &&
    columnMapping.transactionType >= 0 &&
    columnMapping.asset >= 0 &&
    columnMapping.quantity >= 0

  return (
    <div className={classes.root}>
      <Typography variant="h5" gutterBottom>
        Import Cryptocurrency Transactions
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Import crypto transactions from exchanges to calculate capital
        gains/losses for Form 8949. Staking rewards and other income will be
        flagged for reporting as ordinary income.
      </Typography>

      {importSuccess && (
        <Alert
          severity="success"
          onClose={() => setImportSuccess(false)}
          className={classes.section}
        >
          Transactions imported successfully! View them in Other Investments.
        </Alert>
      )}

      {/* Step 1: Select Exchange and Cost Basis Method */}
      <Paper className={`${classes.root} ${classes.section}`}>
        <Typography variant="h6" gutterBottom>
          Step 1: Select Exchange and Options
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Exchange</InputLabel>
              <Select
                value={selectedExchange}
                onChange={(e) =>
                  setSelectedExchange(e.target.value as CryptoExchange)
                }
              >
                <MenuItem value="">-- Select Exchange --</MenuItem>
                <MenuItem value="coinbase">Coinbase</MenuItem>
                <MenuItem value="kraken">Kraken</MenuItem>
                <MenuItem value="generic">Other / Generic</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Cost Basis Method</InputLabel>
              <Select
                value={costBasisMethod}
                onChange={(e) =>
                  handleCostBasisChange(e.target.value as CostBasisMethod)
                }
              >
                {COST_BASIS_METHODS.map((method) => (
                  <MenuItem key={method.value} value={method.value}>
                    {method.label}
                    <Tooltip title={method.description}>
                      <InfoIcon className={classes.infoIcon} />
                    </Tooltip>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <LoadRaw
              variant="contained"
              color="primary"
              handleData={handleFileLoad}
              accept=".csv,text/csv"
            >
              Load CSV File
            </LoadRaw>
          </Grid>
        </Grid>
      </Paper>

      {/* Step 2: Generic Mapping (if needed) */}
      {selectedExchange === 'generic' && csvContent && (
        <Paper className={`${classes.root} ${classes.section}`}>
          <Typography variant="h6" gutterBottom>
            Step 2: Map Columns
          </Typography>
          <Grid container spacing={2} style={{ marginBottom: 16 }}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label="Skip Header Rows"
                value={skipHeaderRows}
                onChange={(e) =>
                  setSkipHeaderRows(Math.max(0, parseInt(e.target.value) || 0))
                }
                InputProps={{ inputProps: { min: 0 } }}
                helperText="Number of header rows to skip"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Exchange Name"
                value={exchangeName}
                onChange={(e) => setExchangeName(e.target.value)}
                helperText="Name of the exchange (for reference)"
              />
            </Grid>
          </Grid>
          <GenericMappingUI
            headers={csvData.headers}
            columnMapping={columnMapping}
            onMappingChange={handleMappingChange}
            previewRows={csvData.rows}
          />
          <Box className={classes.buttonGroup}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleParse}
              disabled={!isMappingValid}
            >
              Parse Transactions
            </Button>
          </Box>
        </Paper>
      )}

      {/* Parse button for non-generic */}
      {selectedExchange &&
        selectedExchange !== 'generic' &&
        csvContent &&
        !parseResult && (
          <Paper className={`${classes.root} ${classes.section}`}>
            <Button variant="contained" color="primary" onClick={handleParse}>
              Parse Transactions
            </Button>
          </Paper>
        )}

      {/* Step 3: Results */}
      {parseResult && (
        <Paper className={`${classes.root} ${classes.section}`}>
          <Typography variant="h6" gutterBottom>
            {selectedExchange === 'generic' ? 'Step 3' : 'Step 2'}: Review
            Transactions
          </Typography>

          {/* Tabs for different views */}
          <Tabs value={activeTab} onChange={(_, v: number) => setActiveTab(v)}>
            <Tab label={`Form 8949 (${parseResult.transactions.length})`} />
            <Tab label={`All Transactions (${cryptoTransactions.length})`} />
          </Tabs>

          <div className={classes.tabPanel}>
            {/* Errors */}
            {parseResult.errors.length > 0 && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography color="error">
                    {parseResult.errors.length} Error
                    {parseResult.errors.length !== 1 ? 's' : ''}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    {parseResult.errors.map((error, index) => (
                      <Alert
                        severity="error"
                        key={index}
                        style={{ marginBottom: 8 }}
                      >
                        Row {error.row}: {error.message}
                      </Alert>
                    ))}
                  </Box>
                </AccordionDetails>
              </Accordion>
            )}

            {/* Warnings */}
            {parseResult.warnings.length > 0 && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography color="textSecondary">
                    {parseResult.warnings.length} Warning
                    {parseResult.warnings.length !== 1 ? 's' : ''}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    {parseResult.warnings.map((warning, index) => (
                      <Alert
                        severity="warning"
                        key={index}
                        style={{ marginBottom: 8 }}
                      >
                        {warning}
                      </Alert>
                    ))}
                  </Box>
                </AccordionDetails>
              </Accordion>
            )}

            {/* Transaction Tables */}
            {activeTab === 0 && parseResult.transactions.length > 0 && (
              <>
                <Typography
                  variant="subtitle1"
                  gutterBottom
                  style={{ marginTop: 16 }}
                >
                  Form 8949 Transactions (Sells/Dispositions)
                </Typography>
                <TransactionTable
                  transactions={parseResult.transactions}
                  selectedIndices={selectedTransactions}
                  onSelectionChange={setSelectedTransactions}
                />
              </>
            )}

            {activeTab === 1 && cryptoTransactions.length > 0 && (
              <>
                <Typography
                  variant="subtitle1"
                  gutterBottom
                  style={{ marginTop: 16 }}
                >
                  All Crypto Transactions
                </Typography>
                <CryptoTransactionTable transactions={cryptoTransactions} />
              </>
            )}

            {activeTab === 0 && parseResult.transactions.length === 0 && (
              <Alert severity="info" style={{ marginTop: 16 }}>
                No taxable sales found. Buys, deposits, and income transactions
                are tracked for cost basis.
              </Alert>
            )}
          </div>

          {/* Summary */}
          {summary && (
            <Paper className={classes.summaryBox} variant="outlined">
              <Typography variant="h6" gutterBottom>
                Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">
                    Short-Term Capital Gains
                  </Typography>
                  <Typography>
                    Gains: {formatCurrency(summary.shortTermGain)} | Losses:{' '}
                    {formatCurrency(summary.shortTermLoss)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Net:{' '}
                    <strong
                      className={
                        summary.shortTermNet >= 0 ? classes.gain : classes.loss
                      }
                    >
                      {formatCurrency(summary.shortTermNet)}
                    </strong>
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">
                    Long-Term Capital Gains
                  </Typography>
                  <Typography>
                    Gains: {formatCurrency(summary.longTermGain)} | Losses:{' '}
                    {formatCurrency(summary.longTermLoss)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Net:{' '}
                    <strong
                      className={
                        summary.longTermNet >= 0 ? classes.gain : classes.loss
                      }
                    >
                      {formatCurrency(summary.longTermNet)}
                    </strong>
                  </Typography>
                </Grid>
                {summary.income.totalIncome > 0 && (
                  <Grid item xs={12}>
                    <Alert severity="info">
                      <Typography variant="subtitle2">
                        Crypto Income (Report as Ordinary Income)
                      </Typography>
                      <Typography variant="body2">
                        Staking Rewards:{' '}
                        {formatCurrency(summary.income.stakingRewards)} |
                        Mining: {formatCurrency(summary.income.miningIncome)} |
                        Airdrops: {formatCurrency(summary.income.airdropValue)}{' '}
                        | Other: {formatCurrency(summary.income.otherIncome)}
                      </Typography>
                      <Typography variant="body2">
                        <strong>
                          Total Income:{' '}
                          {formatCurrency(summary.income.totalIncome)}
                        </strong>
                      </Typography>
                    </Alert>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Typography variant="body1">
                    <strong>Total Net Gain/Loss: </strong>
                    <span
                      className={
                        summary.totalNet >= 0 ? classes.gain : classes.loss
                      }
                    >
                      {formatCurrency(summary.totalNet)}
                    </span>
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          )}

          {/* Action Buttons */}
          <Box className={classes.buttonGroup}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleImport}
              disabled={selectedTransactions.size === 0}
            >
              Import {selectedTransactions.size} Transaction
              {selectedTransactions.size !== 1 ? 's' : ''}
            </Button>
            <Button variant="outlined" onClick={handleReset}>
              Reset
            </Button>
          </Box>
        </Paper>
      )}
    </div>
  )
}

export default CryptoImport
