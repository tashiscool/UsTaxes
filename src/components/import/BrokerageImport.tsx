/**
 * Brokerage CSV Import Component
 *
 * Provides UI for importing brokerage transaction CSVs from:
 * - TD Ameritrade
 * - Charles Schwab
 * - Fidelity
 * - Generic (user-defined mapping)
 *
 * The imported transactions populate Form 8949 and Schedule D.
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
  FormHelperText
} from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import { makeStyles, createStyles, Theme } from '@material-ui/core/styles'
import { useDispatch } from 'ustaxes/redux'
import * as actions from 'ustaxes/redux/actions'
import { LoadRaw } from 'ustaxes/redux/fs/Load'
import {
  BrokerageType,
  BrokerageTransaction,
  transactionsToAssets,
  ParseResult
} from 'ustaxes/core/import/brokerageParser'
import {
  autoParseContent,
  parseWithType,
  getBrokerageName,
  getSupportedBrokerages,
  GENERIC_FIELDS,
  GenericParserConfig
} from 'ustaxes/core/import/parsers'
import { ColumnMapping } from 'ustaxes/core/import/brokerageParser'

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
    covered: {
      backgroundColor: theme.palette.info.light
    },
    nonCovered: {
      backgroundColor: theme.palette.grey[400]
    },
    washSale: {
      backgroundColor: theme.palette.error.light
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
    }
  })
)

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

interface GenericMappingProps {
  headers: string[]
  columnMapping: ColumnMapping
  onMappingChange: (field: keyof ColumnMapping, columnIndex: number) => void
  previewRows: string[][]
}

/**
 * Component for generic CSV column mapping
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
        {GENERIC_FIELDS.map((field) => (
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
                {previewRows.slice(0, 3).map((row, rowIndex) => (
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
 * Table displaying parsed transactions
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
            <TableCell>Symbol</TableCell>
            <TableCell>Date Acquired</TableCell>
            <TableCell>Date Sold</TableCell>
            <TableCell align="right">Proceeds</TableCell>
            <TableCell align="right">Cost Basis</TableCell>
            <TableCell align="right">Gain/Loss</TableCell>
            <TableCell>Type</TableCell>
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
                {tx.description && (
                  <Typography
                    variant="caption"
                    display="block"
                    color="textSecondary"
                  >
                    {tx.description.slice(0, 30)}
                    {tx.description.length > 30 ? '...' : ''}
                  </Typography>
                )}
              </TableCell>
              <TableCell>{formatDate(tx.dateAcquired)}</TableCell>
              <TableCell>{formatDate(tx.dateSold)}</TableCell>
              <TableCell align="right">{formatCurrency(tx.proceeds)}</TableCell>
              <TableCell align="right">
                {formatCurrency(tx.costBasis)}
              </TableCell>
              <TableCell
                align="right"
                style={{ color: tx.gainLoss >= 0 ? 'green' : 'red' }}
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
                <Chip
                  size="small"
                  label={tx.isCovered ? 'Covered' : 'Non-Covered'}
                  className={`${classes.chip} ${
                    tx.isCovered ? classes.covered : classes.nonCovered
                  }`}
                />
                {tx.washSaleDisallowed && (
                  <Chip
                    size="small"
                    label={`Wash: ${formatCurrency(tx.washSaleDisallowed)}`}
                    className={`${classes.chip} ${classes.washSale}`}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

/**
 * Main Brokerage Import Component
 */
export const BrokerageImport = (): ReactElement => {
  const classes = useStyles()
  const dispatch = useDispatch()

  // State
  const [selectedBrokerage, setSelectedBrokerage] = useState<
    BrokerageType | ''
  >('')
  const [csvContent, setCsvContent] = useState<string>('')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [detectedBrokerage, setDetectedBrokerage] =
    useState<BrokerageType | null>(null)
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(
    new Set()
  )
  const [skipHeaderRows, setSkipHeaderRows] = useState<number>(1)
  const [importSuccess, setImportSuccess] = useState<boolean>(false)

  // Generic mapping state
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    symbol: -1,
    dateAcquired: -1,
    dateSold: -1,
    proceeds: -1,
    costBasis: -1
  })

  // Parsed CSV headers and rows for generic mapping
  const csvData = useMemo(() => {
    if (!csvContent) return { headers: [], rows: [] }

    const lines = csvContent.split('\n').filter((line) => line.trim())
    if (lines.length === 0) return { headers: [], rows: [] }

    // Simple CSV parsing for preview
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
    const rows = lines.slice(1).map(parseRow)

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

    const washSaleTotal = txs
      .filter((tx) => tx.washSaleDisallowed)
      .reduce((sum, tx) => sum + (tx.washSaleDisallowed ?? 0), 0)

    return {
      totalTransactions: txs.length,
      shortTermGain,
      shortTermLoss,
      shortTermNet: shortTermGain + shortTermLoss,
      longTermGain,
      longTermLoss,
      longTermNet: longTermGain + longTermLoss,
      washSaleTotal,
      coveredCount: txs.filter((tx) => tx.isCovered).length,
      nonCoveredCount: txs.filter((tx) => !tx.isCovered).length
    }
  }, [parseResult, selectedTransactions])

  /**
   * Handle CSV file load
   */
  const handleFileLoad = (content: string) => {
    setCsvContent(content)
    setParseResult(null)
    setSelectedTransactions(new Set())
    setImportSuccess(false)

    // Auto-detect brokerage
    const { brokerageType, result } = autoParseContent(content)
    setDetectedBrokerage(brokerageType)

    if (brokerageType && result.transactions.length > 0) {
      setSelectedBrokerage(brokerageType)
      setParseResult(result)
      setSelectedTransactions(new Set(result.transactions.map((_, i) => i)))
    }
  }

  /**
   * Parse with selected brokerage type
   */
  const handleParse = () => {
    if (!csvContent || !selectedBrokerage) return

    let result: ParseResult

    if (selectedBrokerage === 'generic') {
      const config: GenericParserConfig = {
        columnMapping,
        skipHeaderRows,
        defaultIsCovered: true
      }
      result = parseWithType(csvContent, 'generic', config)
    } else {
      result = parseWithType(csvContent, selectedBrokerage)
    }

    setParseResult(result)
    if (result.transactions.length > 0) {
      setSelectedTransactions(new Set(result.transactions.map((_, i) => i)))
    }
  }

  /**
   * Import selected transactions
   */
  const handleImport = () => {
    if (!parseResult || !selectedBrokerage) return

    const toImport = parseResult.transactions.filter((_, i) =>
      selectedTransactions.has(i)
    )
    if (toImport.length === 0) return

    const assets = transactionsToAssets(toImport)
    dispatch(
      actions.importBrokerageTransactions({
        brokerageType: selectedBrokerage,
        transactions: assets
      })
    )

    setImportSuccess(true)
    // Reset state
    setCsvContent('')
    setParseResult(null)
    setSelectedTransactions(new Set())
    setSelectedBrokerage('')
    setDetectedBrokerage(null)
  }

  /**
   * Reset all state
   */
  const handleReset = () => {
    setCsvContent('')
    setParseResult(null)
    setSelectedTransactions(new Set())
    setSelectedBrokerage('')
    setDetectedBrokerage(null)
    setImportSuccess(false)
    setColumnMapping({
      symbol: -1,
      dateAcquired: -1,
      dateSold: -1,
      proceeds: -1,
      costBasis: -1
    })
    setSkipHeaderRows(1)
  }

  /**
   * Handle column mapping change for generic parser
   */
  const handleMappingChange = (
    field: keyof ColumnMapping,
    columnIndex: number
  ) => {
    setColumnMapping((prev) => ({
      ...prev,
      [field]: columnIndex
    }))
  }

  return (
    <div className={classes.root}>
      <Typography variant="h5" gutterBottom>
        Import Brokerage Transactions
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Import capital gains/losses from your brokerage CSV export. Transactions
        will be added to Form 8949 and Schedule D.
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

      {/* Step 1: Select Brokerage */}
      <Paper className={`${classes.root} ${classes.section}`}>
        <Typography variant="h6" gutterBottom>
          Step 1: Select Brokerage
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Brokerage</InputLabel>
              <Select
                value={selectedBrokerage}
                onChange={(e) =>
                  setSelectedBrokerage(e.target.value as BrokerageType)
                }
              >
                <MenuItem value="">-- Select Brokerage --</MenuItem>
                {getSupportedBrokerages().map((type) => (
                  <MenuItem key={type} value={type}>
                    {getBrokerageName(type)}
                    {detectedBrokerage === type && ' (Detected)'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
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

        {detectedBrokerage && (
          <Alert severity="info" style={{ marginTop: 16 }}>
            Auto-detected format:{' '}
            <strong>{getBrokerageName(detectedBrokerage)}</strong>
          </Alert>
        )}
      </Paper>

      {/* Step 2: Generic Mapping (if needed) */}
      {selectedBrokerage === 'generic' && csvContent && (
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
              disabled={
                columnMapping.symbol < 0 ||
                columnMapping.dateAcquired < 0 ||
                columnMapping.dateSold < 0 ||
                columnMapping.proceeds < 0 ||
                columnMapping.costBasis < 0
              }
            >
              Parse Transactions
            </Button>
          </Box>
        </Paper>
      )}

      {/* Parse button for non-generic (if auto-parse didn't work) */}
      {selectedBrokerage &&
        selectedBrokerage !== 'generic' &&
        csvContent &&
        !parseResult && (
          <Paper className={`${classes.root} ${classes.section}`}>
            <Button variant="contained" color="primary" onClick={handleParse}>
              Parse Transactions
            </Button>
          </Paper>
        )}

      {/* Step 3: Parse Results */}
      {parseResult && (
        <Paper className={`${classes.root} ${classes.section}`}>
          <Typography variant="h6" gutterBottom>
            {selectedBrokerage === 'generic' ? 'Step 3' : 'Step 2'}: Review
            Transactions
          </Typography>

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

          {/* Transaction Table */}
          {parseResult.transactions.length > 0 ? (
            <>
              <Typography
                variant="subtitle1"
                gutterBottom
                style={{ marginTop: 16 }}
              >
                {parseResult.transactions.length} transaction
                {parseResult.transactions.length !== 1 ? 's' : ''} found
                {selectedTransactions.size > 0 &&
                  selectedTransactions.size < parseResult.transactions.length &&
                  ` (${selectedTransactions.size} selected)`}
              </Typography>
              <TransactionTable
                transactions={parseResult.transactions}
                selectedIndices={selectedTransactions}
                onSelectionChange={setSelectedTransactions}
              />
            </>
          ) : (
            <Alert severity="warning">
              No transactions found in the CSV file. Please check the format and
              try again.
            </Alert>
          )}

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
                      style={{
                        color: summary.shortTermNet >= 0 ? 'green' : 'red'
                      }}
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
                      style={{
                        color: summary.longTermNet >= 0 ? 'green' : 'red'
                      }}
                    >
                      {formatCurrency(summary.longTermNet)}
                    </strong>
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2">
                    Covered: {summary.coveredCount} | Non-Covered:{' '}
                    {summary.nonCoveredCount}
                    {summary.washSaleTotal > 0 && (
                      <span>
                        {' '}
                        | Wash Sale Disallowed:{' '}
                        <strong style={{ color: 'red' }}>
                          {formatCurrency(summary.washSaleTotal)}
                        </strong>
                      </span>
                    )}
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

export default BrokerageImport
