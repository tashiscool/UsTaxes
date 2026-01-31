/**
 * Payroll/W-2 Import Component
 *
 * Provides UI for importing W-2 data from payroll providers:
 * - ADP
 * - Paychex
 * - Gusto
 *
 * Features:
 * - Provider selector with auto-detection
 * - File upload for CSV imports
 * - W-2 data preview
 * - Validation and import to tax data
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
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Tooltip,
  IconButton
} from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import InfoIcon from '@material-ui/icons/Info'
import VisibilityIcon from '@material-ui/icons/Visibility'
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff'
import { makeStyles, createStyles, Theme } from '@material-ui/core/styles'
import { useDispatch } from 'ustaxes/redux'
import * as actions from 'ustaxes/redux/actions'
import { LoadRaw } from 'ustaxes/redux/fs/Load'
import {
  PayrollProvider,
  PayrollParseResult,
  W2ImportData,
  autoParsePayroll,
  parseWithProvider,
  getProviderName,
  getSupportedProviders,
  validateW2Data,
  formatEIN,
  maskSSN,
  getBox12Description
} from 'ustaxes/core/import/payroll'

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
    w2Card: {
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: theme.shape.borderRadius
    },
    w2Header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing(1)
    },
    w2Grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: theme.spacing(2)
    },
    w2Field: {
      '& .label': {
        color: theme.palette.text.secondary,
        fontSize: '0.75rem',
        marginBottom: theme.spacing(0.5)
      },
      '& .value': {
        fontWeight: 500
      }
    },
    moneyValue: {
      fontFamily: 'monospace'
    },
    validated: {
      borderColor: theme.palette.success.main
    },
    hasIssues: {
      borderColor: theme.palette.warning.main
    }
  })
)

/**
 * Format currency for display
 */
const formatCurrency = (value: number | undefined): string => {
  if (value === undefined) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value)
}

interface W2DisplayProps {
  w2: W2ImportData
  index: number
  selected: boolean
  onToggle: () => void
  showSSN: boolean
}

/**
 * Component to display a single W-2
 */
const W2Display = ({ w2, index, selected, onToggle, showSSN }: W2DisplayProps): ReactElement => {
  const classes = useStyles()
  const issues = validateW2Data(w2)
  const hasIssues = issues.length > 0

  return (
    <Paper
      className={`${classes.w2Card} ${hasIssues ? classes.hasIssues : classes.validated}`}
      elevation={selected ? 3 : 1}
    >
      <div className={classes.w2Header}>
        <Box display="flex" alignItems="center">
          <Checkbox
            checked={selected}
            onChange={onToggle}
            color="primary"
          />
          <Typography variant="h6">
            W-2 #{index + 1}: {w2.employerName || 'Unknown Employer'}
          </Typography>
          {w2.source && (
            <Chip
              size="small"
              label={w2.source}
              className={classes.chip}
              style={{ marginLeft: 8 }}
            />
          )}
        </Box>
        {hasIssues && (
          <Tooltip title={issues.join(', ')}>
            <Chip
              size="small"
              label={`${issues.length} issue${issues.length !== 1 ? 's' : ''}`}
              color="secondary"
            />
          </Tooltip>
        )}
      </div>

      <div className={classes.w2Grid}>
        {/* Employer Info */}
        <div className={classes.w2Field}>
          <div className="label">Employer EIN</div>
          <div className="value">{w2.employerEIN ? formatEIN(w2.employerEIN) : '-'}</div>
        </div>

        {/* Employee Info */}
        {w2.employeeName && (
          <div className={classes.w2Field}>
            <div className="label">Employee Name</div>
            <div className="value">{w2.employeeName}</div>
          </div>
        )}
        {w2.employeeSSN && (
          <div className={classes.w2Field}>
            <div className="label">Employee SSN</div>
            <div className="value">{showSSN ? w2.employeeSSN : maskSSN(w2.employeeSSN)}</div>
          </div>
        )}

        {/* Box 1-2 */}
        <div className={classes.w2Field}>
          <div className="label">Box 1: Wages</div>
          <div className={`value ${classes.moneyValue}`}>{formatCurrency(w2.wages)}</div>
        </div>
        <div className={classes.w2Field}>
          <div className="label">Box 2: Federal Tax Withheld</div>
          <div className={`value ${classes.moneyValue}`}>{formatCurrency(w2.federalWithholding)}</div>
        </div>

        {/* Box 3-6 */}
        {w2.ssWages !== undefined && (
          <div className={classes.w2Field}>
            <div className="label">Box 3: SS Wages</div>
            <div className={`value ${classes.moneyValue}`}>{formatCurrency(w2.ssWages)}</div>
          </div>
        )}
        {w2.ssTax !== undefined && (
          <div className={classes.w2Field}>
            <div className="label">Box 4: SS Tax</div>
            <div className={`value ${classes.moneyValue}`}>{formatCurrency(w2.ssTax)}</div>
          </div>
        )}
        {w2.medicareWages !== undefined && (
          <div className={classes.w2Field}>
            <div className="label">Box 5: Medicare Wages</div>
            <div className={`value ${classes.moneyValue}`}>{formatCurrency(w2.medicareWages)}</div>
          </div>
        )}
        {w2.medicareTax !== undefined && (
          <div className={classes.w2Field}>
            <div className="label">Box 6: Medicare Tax</div>
            <div className={`value ${classes.moneyValue}`}>{formatCurrency(w2.medicareTax)}</div>
          </div>
        )}

        {/* Box 12 */}
        {w2.box12 && w2.box12.length > 0 && (
          <div className={classes.w2Field} style={{ gridColumn: 'span 2' }}>
            <div className="label">Box 12 Codes</div>
            <div className="value">
              {w2.box12.map((item, i) => (
                <Tooltip key={i} title={getBox12Description(item.code)}>
                  <Chip
                    size="small"
                    label={`${item.code}: ${formatCurrency(item.amount)}`}
                    className={classes.chip}
                  />
                </Tooltip>
              ))}
            </div>
          </div>
        )}

        {/* Box 13 */}
        {(w2.statutoryEmployee || w2.retirementPlan || w2.thirdPartySickPay) && (
          <div className={classes.w2Field}>
            <div className="label">Box 13</div>
            <div className="value">
              {w2.statutoryEmployee && <Chip size="small" label="Statutory" className={classes.chip} />}
              {w2.retirementPlan && <Chip size="small" label="Retirement" className={classes.chip} />}
              {w2.thirdPartySickPay && <Chip size="small" label="3rd Party Sick" className={classes.chip} />}
            </div>
          </div>
        )}

        {/* State Info */}
        {w2.stateCode && (
          <>
            <div className={classes.w2Field}>
              <div className="label">State</div>
              <div className="value">{w2.stateCode}</div>
            </div>
            {w2.stateWages !== undefined && (
              <div className={classes.w2Field}>
                <div className="label">State Wages</div>
                <div className={`value ${classes.moneyValue}`}>{formatCurrency(w2.stateWages)}</div>
              </div>
            )}
            {w2.stateTax !== undefined && (
              <div className={classes.w2Field}>
                <div className="label">State Tax Withheld</div>
                <div className={`value ${classes.moneyValue}`}>{formatCurrency(w2.stateTax)}</div>
              </div>
            )}
          </>
        )}

        {/* Local Info */}
        {w2.localityName && (
          <>
            <div className={classes.w2Field}>
              <div className="label">Locality</div>
              <div className="value">{w2.localityName}</div>
            </div>
            {w2.localWages !== undefined && (
              <div className={classes.w2Field}>
                <div className="label">Local Wages</div>
                <div className={`value ${classes.moneyValue}`}>{formatCurrency(w2.localWages)}</div>
              </div>
            )}
            {w2.localTax !== undefined && (
              <div className={classes.w2Field}>
                <div className="label">Local Tax Withheld</div>
                <div className={`value ${classes.moneyValue}`}>{formatCurrency(w2.localTax)}</div>
              </div>
            )}
          </>
        )}
      </div>
    </Paper>
  )
}

/**
 * Main Payroll Import Component
 */
export const PayrollImport = (): ReactElement => {
  const classes = useStyles()
  const dispatch = useDispatch()

  // State
  const [selectedProvider, setSelectedProvider] = useState<PayrollProvider | ''>('')
  const [csvContent, setCsvContent] = useState<string>('')
  const [parseResult, setParseResult] = useState<PayrollParseResult | null>(null)
  const [detectedProvider, setDetectedProvider] = useState<PayrollProvider | null>(null)
  const [selectedW2s, setSelectedW2s] = useState<Set<number>>(new Set())
  const [importSuccess, setImportSuccess] = useState<boolean>(false)
  const [showSSN, setShowSSN] = useState<boolean>(false)

  // Summary calculations
  const summary = useMemo(() => {
    if (!parseResult || parseResult.w2s.length === 0) {
      return null
    }

    const selected = parseResult.w2s.filter((_, i) => selectedW2s.has(i))
    const w2sToSummarize = selected.length > 0 ? selected : parseResult.w2s

    const totalWages = w2sToSummarize.reduce((sum, w2) => sum + w2.wages, 0)
    const totalFederalTax = w2sToSummarize.reduce((sum, w2) => sum + w2.federalWithholding, 0)
    const totalSSWages = w2sToSummarize.reduce((sum, w2) => sum + (w2.ssWages || 0), 0)
    const totalSSTax = w2sToSummarize.reduce((sum, w2) => sum + (w2.ssTax || 0), 0)
    const totalMedicareWages = w2sToSummarize.reduce((sum, w2) => sum + (w2.medicareWages || 0), 0)
    const totalMedicareTax = w2sToSummarize.reduce((sum, w2) => sum + (w2.medicareTax || 0), 0)
    const totalStateTax = w2sToSummarize.reduce((sum, w2) => sum + (w2.stateTax || 0), 0)
    const totalLocalTax = w2sToSummarize.reduce((sum, w2) => sum + (w2.localTax || 0), 0)

    const hasIssues = w2sToSummarize.some(w2 => validateW2Data(w2).length > 0)

    return {
      count: w2sToSummarize.length,
      totalWages,
      totalFederalTax,
      totalSSWages,
      totalSSTax,
      totalMedicareWages,
      totalMedicareTax,
      totalStateTax,
      totalLocalTax,
      totalWithholding: totalFederalTax + totalStateTax + totalLocalTax,
      hasIssues
    }
  }, [parseResult, selectedW2s])

  /**
   * Handle CSV file load
   */
  const handleFileLoad = (content: string) => {
    setCsvContent(content)
    setParseResult(null)
    setSelectedW2s(new Set())
    setImportSuccess(false)

    // Auto-detect provider
    const { provider, result } = autoParsePayroll(content)
    setDetectedProvider(provider)

    if (provider && result.w2s.length > 0) {
      setSelectedProvider(provider)
      setParseResult(result)
      setSelectedW2s(new Set(result.w2s.map((_, i) => i)))
    }
  }

  /**
   * Parse with selected provider
   */
  const handleParse = () => {
    if (!csvContent || !selectedProvider || selectedProvider === 'generic') return

    const result = parseWithProvider(csvContent, selectedProvider)
    setParseResult(result)

    if (result.w2s.length > 0) {
      setSelectedW2s(new Set(result.w2s.map((_, i) => i)))
    }
  }

  /**
   * Toggle W2 selection
   */
  const toggleW2Selection = (index: number) => {
    const newSet = new Set(selectedW2s)
    if (newSet.has(index)) {
      newSet.delete(index)
    } else {
      newSet.add(index)
    }
    setSelectedW2s(newSet)
  }

  /**
   * Select/deselect all W2s
   */
  const toggleAllW2s = () => {
    if (!parseResult) return

    if (selectedW2s.size === parseResult.w2s.length) {
      setSelectedW2s(new Set())
    } else {
      setSelectedW2s(new Set(parseResult.w2s.map((_, i) => i)))
    }
  }

  /**
   * Import selected W2s
   */
  const handleImport = () => {
    if (!parseResult || !selectedProvider) return

    const toImport = parseResult.w2s.filter((_, i) => selectedW2s.has(i))
    if (toImport.length === 0) return

    // Get the parser to convert to IncomeW2 format
    const providers: Record<Exclude<PayrollProvider, 'generic'>, typeof import('ustaxes/core/import/payroll').adpParser> = {
      adp: require('ustaxes/core/import/payroll').adpParser,
      paychex: require('ustaxes/core/import/payroll').paychexParser,
      gusto: require('ustaxes/core/import/payroll').gustoParser
    }

    if (selectedProvider !== 'generic') {
      const parser = providers[selectedProvider]

      for (const w2Data of toImport) {
        const incomeW2 = parser.toIncomeW2(w2Data)
        dispatch(actions.addW2(incomeW2))
      }
    }

    setImportSuccess(true)
    setCsvContent('')
    setParseResult(null)
    setSelectedW2s(new Set())
    setSelectedProvider('')
    setDetectedProvider(null)
  }

  /**
   * Reset all state
   */
  const handleReset = () => {
    setCsvContent('')
    setParseResult(null)
    setSelectedW2s(new Set())
    setSelectedProvider('')
    setDetectedProvider(null)
    setImportSuccess(false)
  }

  return (
    <div className={classes.root}>
      <Typography variant="h5" gutterBottom>
        Import W-2 from Payroll Provider
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Import W-2 wage and tax data from your payroll provider's export.
        Supported providers: ADP, Paychex, Gusto.
      </Typography>

      {importSuccess && (
        <Alert severity="success" onClose={() => setImportSuccess(false)} className={classes.section}>
          W-2 data imported successfully! View it in the Wages (W2) section.
        </Alert>
      )}

      {/* Step 1: Select Provider */}
      <Paper className={`${classes.root} ${classes.section}`}>
        <Typography variant="h6" gutterBottom>
          Step 1: Select Payroll Provider
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Payroll Provider</InputLabel>
              <Select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as PayrollProvider)}
              >
                <MenuItem value="">-- Select Provider --</MenuItem>
                {getSupportedProviders().filter(p => p !== 'generic').map((provider) => (
                  <MenuItem key={provider} value={provider}>
                    {getProviderName(provider)}
                    {detectedProvider === provider && ' (Detected)'}
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

        {detectedProvider && (
          <Alert severity="info" style={{ marginTop: 16 }}>
            Auto-detected format: <strong>{getProviderName(detectedProvider)}</strong>
          </Alert>
        )}
      </Paper>

      {/* Parse button (if auto-parse didn't work) */}
      {selectedProvider && selectedProvider !== 'generic' && csvContent && !parseResult && (
        <Paper className={`${classes.root} ${classes.section}`}>
          <Button variant="contained" color="primary" onClick={handleParse}>
            Parse W-2 Data
          </Button>
        </Paper>
      )}

      {/* Step 2: Review W-2s */}
      {parseResult && (
        <Paper className={`${classes.root} ${classes.section}`}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Step 2: Review W-2 Data
            </Typography>
            <Box>
              <Tooltip title={showSSN ? 'Hide SSN' : 'Show SSN'}>
                <IconButton onClick={() => setShowSSN(!showSSN)} size="small">
                  {showSSN ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              </Tooltip>
              <Button
                size="small"
                onClick={toggleAllW2s}
                style={{ marginLeft: 8 }}
              >
                {selectedW2s.size === parseResult.w2s.length ? 'Deselect All' : 'Select All'}
              </Button>
            </Box>
          </Box>

          {/* Errors */}
          {parseResult.errors.length > 0 && (
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography color="error">
                  {parseResult.errors.length} Error{parseResult.errors.length !== 1 ? 's' : ''}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box>
                  {parseResult.errors.map((error, index) => (
                    <Alert severity="error" key={index} style={{ marginBottom: 8 }}>
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
                  {parseResult.warnings.length} Warning{parseResult.warnings.length !== 1 ? 's' : ''}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box>
                  {parseResult.warnings.map((warning, index) => (
                    <Alert severity="warning" key={index} style={{ marginBottom: 8 }}>
                      {warning}
                    </Alert>
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>
          )}

          {/* W-2 Display */}
          {parseResult.w2s.length > 0 ? (
            <Box mt={2}>
              {parseResult.w2s.map((w2, index) => (
                <W2Display
                  key={index}
                  w2={w2}
                  index={index}
                  selected={selectedW2s.has(index)}
                  onToggle={() => toggleW2Selection(index)}
                  showSSN={showSSN}
                />
              ))}
            </Box>
          ) : (
            <Alert severity="warning">
              No W-2 data found in the CSV file. Please check the format and try again.
            </Alert>
          )}

          {/* Summary */}
          {summary && (
            <Paper className={classes.summaryBox} variant="outlined">
              <Typography variant="h6" gutterBottom>
                Summary {selectedW2s.size > 0 && selectedW2s.size < parseResult.w2s.length && `(${selectedW2s.size} selected)`}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2">Total W-2s</Typography>
                  <Typography variant="h5">{summary.count}</Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2">Total Wages</Typography>
                  <Typography variant="h5" className={classes.moneyValue}>
                    {formatCurrency(summary.totalWages)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2">Federal Tax Withheld</Typography>
                  <Typography variant="h5" className={classes.moneyValue}>
                    {formatCurrency(summary.totalFederalTax)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2">Total Withholding</Typography>
                  <Typography variant="h5" className={classes.moneyValue}>
                    {formatCurrency(summary.totalWithholding)}
                  </Typography>
                </Grid>
              </Grid>

              {summary.hasIssues && (
                <Alert severity="warning" style={{ marginTop: 16 }}>
                  Some W-2s have validation issues. Please review before importing.
                </Alert>
              )}
            </Paper>
          )}

          {/* Action Buttons */}
          <Box className={classes.buttonGroup}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleImport}
              disabled={selectedW2s.size === 0}
            >
              Import {selectedW2s.size} W-2{selectedW2s.size !== 1 ? 's' : ''}
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

export default PayrollImport
