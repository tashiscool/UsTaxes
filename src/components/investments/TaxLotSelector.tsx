/**
 * TaxLotSelector Component
 *
 * UI for selecting specific tax lots when selling securities.
 * Supports FIFO, LIFO, and Specific Identification methods.
 * Shows tax impact preview for different selection strategies.
 */

import { ReactElement, useState, useMemo } from 'react'
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery
} from '@material-ui/core'
import { makeStyles, Theme, createStyles } from '@material-ui/core/styles'
import { Alert } from '@material-ui/lab'
import { TaxLot, TaxLotSelection, CostBasisMethod } from 'ustaxes/core/data'
import {
  selectLotsFIFO,
  selectLotsLIFO,
  calculateSaleGainLoss,
  getTaxLotPreviews,
  TaxLotPreview
} from 'ustaxes/core/investments/costBasis'
import Currency from 'ustaxes/components/input/Currency'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      padding: theme.spacing(2),
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2)
    },
    table: {
      minWidth: 650
    },
    selectedRow: {
      backgroundColor: theme.palette.action.selected
    },
    longTerm: {
      color: theme.palette.success.main
    },
    shortTerm: {
      color: theme.palette.warning.main
    },
    gain: {
      color: theme.palette.success.main
    },
    loss: {
      color: theme.palette.error.main
    },
    previewSection: {
      marginTop: theme.spacing(2),
      padding: theme.spacing(2),
      backgroundColor: theme.palette.background.default
    },
    methodSelector: {
      minWidth: 200,
      marginBottom: theme.spacing(2)
    },
    sharesInput: {
      width: 100
    },
    summaryBox: {
      padding: theme.spacing(2),
      marginTop: theme.spacing(2)
    }
  })
)

interface TaxLotSelectorProps {
  lots: TaxLot<Date>[]
  sharesToSell: number
  currentPrice: number
  saleDate?: Date
  onSelectionChange: (
    selections: TaxLotSelection[],
    method: CostBasisMethod
  ) => void
  defaultMethod?: CostBasisMethod
  isMutualFund?: boolean
}

interface LotSelectionState {
  lotId: string
  selected: boolean
  sharesToSell: number
}

const TaxLotSelector = ({
  lots,
  sharesToSell,
  currentPrice,
  saleDate = new Date(),
  onSelectionChange,
  defaultMethod = CostBasisMethod.FIFO,
  isMutualFund = false
}: TaxLotSelectorProps): ReactElement => {
  const classes = useStyles()
  useMediaQuery('(prefers-color-scheme: dark)') // For theme-aware styling

  const [method, setMethod] = useState<CostBasisMethod>(
    isMutualFund ? CostBasisMethod.AverageCost : defaultMethod
  )
  const [lotSelections, setLotSelections] = useState<LotSelectionState[]>(
    lots
      .filter((l) => l.remainingShares > 0)
      .map((lot) => ({
        lotId: lot.id,
        selected: false,
        sharesToSell: 0
      }))
  )

  // Get previews with unrealized gains info
  const lotPreviews = useMemo(
    () => getTaxLotPreviews(lots, currentPrice, saleDate),
    [lots, currentPrice, saleDate]
  )

  // Auto-calculate selections based on method
  const autoSelections = useMemo(() => {
    switch (method) {
      case CostBasisMethod.FIFO:
        return selectLotsFIFO(lots, sharesToSell)
      case CostBasisMethod.LIFO:
        return selectLotsLIFO(lots, sharesToSell)
      case CostBasisMethod.AverageCost:
        return selectLotsFIFO(lots, sharesToSell) // Use FIFO order for tracking
      case CostBasisMethod.SpecificID:
        return lotSelections
          .filter((ls) => ls.selected && ls.sharesToSell > 0)
          .map((ls) => ({
            lotId: ls.lotId,
            sharesFromLot: ls.sharesToSell
          }))
      default:
        return []
    }
  }, [method, lots, sharesToSell, lotSelections])

  // Calculate tax impact preview
  const taxPreview = useMemo(() => {
    const proceeds = sharesToSell * currentPrice
    return calculateSaleGainLoss(
      lots,
      autoSelections,
      saleDate,
      proceeds,
      method
    )
  }, [lots, autoSelections, saleDate, sharesToSell, currentPrice, method])

  const handleMethodChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const newMethod = event.target.value as CostBasisMethod
    setMethod(newMethod)

    // Reset selections when changing methods
    if (newMethod !== CostBasisMethod.SpecificID) {
      const newSelections =
        method === CostBasisMethod.FIFO
          ? selectLotsFIFO(lots, sharesToSell)
          : method === CostBasisMethod.LIFO
          ? selectLotsLIFO(lots, sharesToSell)
          : selectLotsFIFO(lots, sharesToSell)
      onSelectionChange(newSelections, newMethod)
    }
  }

  const handleLotToggle = (lotId: string) => {
    setLotSelections((prev) =>
      prev.map((ls) =>
        ls.lotId === lotId ? { ...ls, selected: !ls.selected } : ls
      )
    )
  }

  const handleSharesChange = (lotId: string, shares: number) => {
    const lot = lots.find((l) => l.id === lotId)
    const maxShares = lot?.remainingShares ?? 0
    const validShares = Math.min(Math.max(0, shares), maxShares)

    setLotSelections((prev) =>
      prev.map((ls) =>
        ls.lotId === lotId
          ? { ...ls, sharesToSell: validShares, selected: validShares > 0 }
          : ls
      )
    )
  }

  const handleApplySelection = () => {
    onSelectionChange(autoSelections, method)
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getPreviewForLot = (lotId: string): TaxLotPreview | undefined => {
    return lotPreviews.find((p) => p.lot.id === lotId)
  }

  const totalSelectedShares = autoSelections.reduce(
    (sum, s) => sum + s.sharesFromLot,
    0
  )

  const availableMethods = isMutualFund
    ? [CostBasisMethod.AverageCost, CostBasisMethod.SpecificID]
    : Object.values(CostBasisMethod)

  return (
    <Paper className={classes.root}>
      <Typography variant="h6" gutterBottom>
        Select Tax Lots for Sale
      </Typography>

      <Grid container spacing={2} alignItems="center">
        <Grid item>
          <FormControl className={classes.methodSelector} variant="outlined">
            <InputLabel>Cost Basis Method</InputLabel>
            <Select
              value={method}
              onChange={handleMethodChange}
              label="Cost Basis Method"
            >
              {availableMethods.map((m) => (
                <MenuItem key={m} value={m}>
                  {m === CostBasisMethod.FIFO && 'FIFO (First In, First Out)'}
                  {m === CostBasisMethod.LIFO && 'LIFO (Last In, First Out)'}
                  {m === CostBasisMethod.SpecificID &&
                    'Specific Identification'}
                  {m === CostBasisMethod.AverageCost && 'Average Cost'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item>
          <Typography variant="body2" color="textSecondary">
            Selling {sharesToSell} shares at ${currentPrice.toFixed(2)}/share
          </Typography>
        </Grid>
      </Grid>

      <TableContainer>
        <Table className={classes.table} size="small">
          <TableHead>
            <TableRow>
              {method === CostBasisMethod.SpecificID && (
                <TableCell padding="checkbox">Select</TableCell>
              )}
              <TableCell>Purchase Date</TableCell>
              <TableCell align="right">Shares Available</TableCell>
              <TableCell align="right">Cost/Share</TableCell>
              <TableCell align="right">Total Cost Basis</TableCell>
              <TableCell align="right">Unrealized Gain/Loss</TableCell>
              <TableCell>Holding Period</TableCell>
              {method === CostBasisMethod.SpecificID && (
                <TableCell align="right">Shares to Sell</TableCell>
              )}
              {method !== CostBasisMethod.SpecificID && (
                <TableCell align="right">Auto-Selected</TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {lots
              .filter((lot) => lot.remainingShares > 0)
              .map((lot) => {
                const preview = getPreviewForLot(lot.id)
                const selection = autoSelections.find((s) => s.lotId === lot.id)
                const localSelection = lotSelections.find(
                  (ls) => ls.lotId === lot.id
                )
                const isSelected =
                  method === CostBasisMethod.SpecificID
                    ? localSelection?.selected ?? false
                    : (selection?.sharesFromLot ?? 0) > 0

                return (
                  <TableRow
                    key={lot.id}
                    className={isSelected ? classes.selectedRow : undefined}
                  >
                    {method === CostBasisMethod.SpecificID && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={localSelection?.selected ?? false}
                          onChange={() => handleLotToggle(lot.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell>{formatDate(lot.purchaseDate)}</TableCell>
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
                          (lot.adjustedCostBasis * lot.remainingShares) /
                          lot.shares
                        }
                        plain
                      />
                    </TableCell>
                    <TableCell align="right">
                      <span
                        className={
                          (preview?.unrealizedGain ?? 0) >= 0
                            ? classes.gain
                            : classes.loss
                        }
                      >
                        <Currency value={preview?.unrealizedGain ?? 0} />
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          preview?.isLongTerm
                            ? classes.longTerm
                            : classes.shortTerm
                        }
                      >
                        {preview?.isLongTerm ? 'Long-term' : 'Short-term'}
                        {!preview?.isLongTerm &&
                          preview?.daysUntilLongTerm !== undefined && (
                            <Typography variant="caption" display="block">
                              ({preview.daysUntilLongTerm} days to long-term)
                            </Typography>
                          )}
                      </span>
                    </TableCell>
                    {method === CostBasisMethod.SpecificID && (
                      <TableCell align="right">
                        <TextField
                          type="number"
                          size="small"
                          className={classes.sharesInput}
                          value={localSelection?.sharesToSell ?? 0}
                          onChange={(e) =>
                            handleSharesChange(
                              lot.id,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          inputProps={{
                            min: 0,
                            max: lot.remainingShares,
                            step: 0.0001
                          }}
                          disabled={!localSelection?.selected}
                        />
                      </TableCell>
                    )}
                    {method !== CostBasisMethod.SpecificID && (
                      <TableCell align="right">
                        {selection?.sharesFromLot !== undefined
                          ? selection.sharesFromLot.toFixed(4)
                          : '-'}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Tax Impact Preview */}
      <Paper className={classes.previewSection} elevation={0}>
        <Typography variant="subtitle1" gutterBottom>
          Tax Impact Preview
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="textSecondary">
              Short-Term Gain/Loss
            </Typography>
            <Typography
              variant="h6"
              className={
                taxPreview.shortTermGain >= 0 ? classes.gain : classes.loss
              }
            >
              <Currency value={taxPreview.shortTermGain} />
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Cost Basis:{' '}
              <Currency value={taxPreview.shortTermCostBasis} plain />
              {' | '}
              Proceeds: <Currency value={taxPreview.shortTermProceeds} plain />
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="textSecondary">
              Long-Term Gain/Loss
            </Typography>
            <Typography
              variant="h6"
              className={
                taxPreview.longTermGain >= 0 ? classes.gain : classes.loss
              }
            >
              <Currency value={taxPreview.longTermGain} />
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Cost Basis:{' '}
              <Currency value={taxPreview.longTermCostBasis} plain />
              {' | '}
              Proceeds: <Currency value={taxPreview.longTermProceeds} plain />
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="body2" color="textSecondary">
              Total Estimated Gain/Loss
            </Typography>
            <Typography
              variant="h5"
              className={
                taxPreview.totalGain >= 0 ? classes.gain : classes.loss
              }
            >
              <Currency value={taxPreview.totalGain} />
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Validation */}
      {totalSelectedShares !== sharesToSell &&
        method === CostBasisMethod.SpecificID && (
          <Alert severity="warning" style={{ marginTop: 16 }}>
            Selected shares ({totalSelectedShares.toFixed(4)}) do not match
            shares to sell ({sharesToSell}). Please adjust your selection.
          </Alert>
        )}

      {taxPreview.isWashSale && (
        <Alert severity="info" style={{ marginTop: 16 }}>
          This sale may trigger wash sale rules. Disallowed loss:{' '}
          <Currency value={taxPreview.washSaleDisallowedLoss} />
        </Alert>
      )}

      <Box mt={2} display="flex" justifyContent="flex-end">
        <Button
          variant="contained"
          color="primary"
          onClick={handleApplySelection}
          disabled={
            method === CostBasisMethod.SpecificID &&
            totalSelectedShares !== sharesToSell
          }
        >
          Apply Selection
        </Button>
      </Box>
    </Paper>
  )
}

export default TaxLotSelector
