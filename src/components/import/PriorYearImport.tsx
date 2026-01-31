import { ReactElement, useState, useCallback } from 'react'
import {
  Button,
  Grid,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Divider,
  Box,
  Collapse
} from '@material-ui/core'
import { Alert, AlertTitle } from '@material-ui/lab'
import {
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  AccountBalance as BankIcon,
  LocationOn as LocationIcon,
  Phone as ContactIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@material-ui/icons'
import { makeStyles, createStyles, Theme } from '@material-ui/core/styles'

import { useDispatch } from 'ustaxes/redux'
import { TaxYear, TaxYears } from 'ustaxes/core/data'
import { LoadRaw } from 'ustaxes/redux/fs/Load'
import * as actions from 'ustaxes/redux/actions'
import {
  validatePriorYearData,
  parsePriorYearJson,
  createImportPreview,
  extractCarryForwardData,
  mapPriorYearData,
  getValidPriorYears,
  detectSourceYear,
  ImportPreview,
  ValidationResult
} from 'ustaxes/core/import/priorYearImport'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      padding: theme.spacing(2)
    },
    paper: {
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2)
    },
    section: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2)
    },
    listItem: {
      paddingTop: theme.spacing(0.5),
      paddingBottom: theme.spacing(0.5)
    },
    importIcon: {
      color: theme.palette.success.main
    },
    skipIcon: {
      color: theme.palette.warning.main
    },
    errorIcon: {
      color: theme.palette.error.main
    },
    progressContainer: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2)
    },
    buttonContainer: {
      marginTop: theme.spacing(2),
      '& > *': {
        marginRight: theme.spacing(1)
      }
    },
    formControl: {
      minWidth: 200,
      marginBottom: theme.spacing(2)
    },
    expandButton: {
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center'
    }
  })
)

interface ImportState {
  step: 'idle' | 'loaded' | 'previewing' | 'importing' | 'complete' | 'error'
  rawData: string | null
  parsedData: unknown | null
  validationResult: ValidationResult | null
  preview: ImportPreview | null
  selectedSourceYear: TaxYear | null
  progress: number
  error: string | null
}

const initialState: ImportState = {
  step: 'idle',
  rawData: null,
  parsedData: null,
  validationResult: null,
  preview: null,
  selectedSourceYear: null,
  progress: 0,
  error: null
}

// Get the current tax year as the target year
const getCurrentTaxYear = (): TaxYear => {
  // Default to Y2025, but this could be made dynamic
  return 'Y2025'
}

const PriorYearImport = (): ReactElement => {
  const classes = useStyles()
  const dispatch = useDispatch()
  const [state, setState] = useState<ImportState>(initialState)
  const [showWarnings, setShowWarnings] = useState(false)
  const [showSkipped, setShowSkipped] = useState(false)

  const targetYear = getCurrentTaxYear()
  const validSourceYears = getValidPriorYears(targetYear)

  // Handle file load
  const handleFileLoad = useCallback(
    (contents: string) => {
      const { data, error } = parsePriorYearJson(contents)

      if (error || !data) {
        setState({
          ...initialState,
          step: 'error',
          error: error ?? 'Failed to parse file'
        })
        return
      }

      // Validate the data
      const validationResult = validatePriorYearData(data)

      // Try to detect the source year
      const detectedYear = detectSourceYear(contents)

      setState({
        step: 'loaded',
        rawData: contents,
        parsedData: data,
        validationResult,
        preview: null,
        selectedSourceYear: detectedYear,
        progress: 0,
        error: validationResult.isValid ? null : validationResult.errors.join(', ')
      })
    },
    []
  )

  // Handle year selection change
  const handleYearChange = useCallback(
    (event: React.ChangeEvent<{ value: unknown }>) => {
      const year = event.target.value as TaxYear
      setState((prev) => ({
        ...prev,
        selectedSourceYear: year
      }))
    },
    []
  )

  // Generate preview
  const handlePreview = useCallback(() => {
    if (!state.parsedData || !state.selectedSourceYear) {
      return
    }

    const preview = createImportPreview(
      state.parsedData as Parameters<typeof createImportPreview>[0],
      state.selectedSourceYear,
      targetYear
    )

    setState((prev) => ({
      ...prev,
      step: 'previewing',
      preview
    }))
  }, [state.parsedData, state.selectedSourceYear, targetYear])

  // Perform the import
  const handleImport = useCallback(() => {
    if (!state.preview || !state.selectedSourceYear) {
      return
    }

    setState((prev) => ({
      ...prev,
      step: 'importing',
      progress: 0
    }))

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setState((prev) => {
        if (prev.progress >= 90) {
          clearInterval(progressInterval)
          return prev
        }
        return { ...prev, progress: prev.progress + 10 }
      })
    }, 100)

    try {
      // Map the data for import
      const mappedData = mapPriorYearData(
        state.preview.carryForwardData,
        targetYear
      )

      // Dispatch the import action
      dispatch(
        actions.importPriorYearData({
          sourceYear: state.selectedSourceYear,
          data: mappedData
        })
      )

      clearInterval(progressInterval)

      setState((prev) => ({
        ...prev,
        step: 'complete',
        progress: 100
      }))
    } catch (e) {
      clearInterval(progressInterval)
      setState((prev) => ({
        ...prev,
        step: 'error',
        error: e instanceof Error ? e.message : 'Import failed'
      }))
    }
  }, [state.preview, state.selectedSourceYear, dispatch, targetYear])

  // Reset the import process
  const handleReset = useCallback(() => {
    setState(initialState)
    setShowWarnings(false)
    setShowSkipped(false)
  }, [])

  // Get icon for a field type
  const getFieldIcon = (field: string): ReactElement => {
    if (field.includes('Taxpayer') || field.includes('Spouse') || field.includes('Dependent')) {
      return <PersonIcon />
    }
    if (field.includes('Employer')) {
      return <BusinessIcon />
    }
    if (field.includes('Bank')) {
      return <BankIcon />
    }
    if (field.includes('State') || field.includes('Residency')) {
      return <LocationIcon />
    }
    if (field.includes('Contact')) {
      return <ContactIcon />
    }
    return <CheckIcon />
  }

  // Render the file picker step
  const renderFilePicker = (): ReactElement => (
    <Paper className={classes.paper}>
      <Typography variant="h6" gutterBottom>
        Load Prior Year Data
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Select a JSON file that was previously exported from UsTaxes. This will
        import structural data like names, addresses, and employer information
        without importing dollar amounts.
      </Typography>
      <LoadRaw
        variant="contained"
        color="primary"
        accept=".json,application/json"
        handleData={handleFileLoad}
      >
        Select JSON File
      </LoadRaw>
    </Paper>
  )

  // Render year selection and validation
  const renderYearSelection = (): ReactElement | null => {
    if (state.step === 'idle') return null

    return (
      <Paper className={classes.paper}>
        <Typography variant="h6" gutterBottom>
          Source Year
        </Typography>

        {state.validationResult && !state.validationResult.isValid && (
          <Alert severity="error" className={classes.section}>
            <AlertTitle>Validation Errors</AlertTitle>
            <List dense>
              {state.validationResult.errors.map((error, idx) => (
                <ListItem key={idx} className={classes.listItem}>
                  <ListItemIcon>
                    <CancelIcon className={classes.errorIcon} />
                  </ListItemIcon>
                  <ListItemText primary={error} />
                </ListItem>
              ))}
            </List>
          </Alert>
        )}

        {state.validationResult &&
          state.validationResult.warnings.length > 0 && (
            <Box className={classes.section}>
              <Box
                className={classes.expandButton}
                onClick={() => setShowWarnings(!showWarnings)}
              >
                <WarningIcon color="action" />
                <Typography
                  variant="body2"
                  color="textSecondary"
                  style={{ marginLeft: 8 }}
                >
                  {state.validationResult.warnings.length} warning(s)
                </Typography>
                {showWarnings ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>
              <Collapse in={showWarnings}>
                <Alert severity="warning">
                  <List dense>
                    {state.validationResult.warnings.map((warning, idx) => (
                      <ListItem key={idx} className={classes.listItem}>
                        <ListItemText primary={warning} />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
              </Collapse>
            </Box>
          )}

        <FormControl className={classes.formControl}>
          <InputLabel id="source-year-label">Import From Year</InputLabel>
          <Select
            labelId="source-year-label"
            value={state.selectedSourceYear ?? ''}
            onChange={handleYearChange}
            disabled={state.step === 'importing' || state.step === 'complete'}
          >
            {validSourceYears.map((year) => (
              <MenuItem key={year} value={year}>
                {TaxYears[year]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography variant="body2" color="textSecondary">
          Data will be imported into tax year {TaxYears[targetYear]}.
        </Typography>

        <Box className={classes.buttonContainer}>
          <Button
            variant="contained"
            color="primary"
            onClick={handlePreview}
            disabled={
              !state.selectedSourceYear ||
              !state.validationResult?.isValid ||
              state.step === 'importing'
            }
          >
            Preview Import
          </Button>
          <Button variant="outlined" onClick={handleReset}>
            Cancel
          </Button>
        </Box>
      </Paper>
    )
  }

  // Render the import preview
  const renderPreview = (): ReactElement | null => {
    if (!state.preview || state.step === 'idle' || state.step === 'loaded') {
      return null
    }

    return (
      <Paper className={classes.paper}>
        <Typography variant="h6" gutterBottom>
          Import Preview
        </Typography>

        <Typography variant="subtitle1" gutterBottom>
          Data to Import
        </Typography>
        <List dense>
          {state.preview.fieldsToImport.map((field, idx) => (
            <ListItem key={idx} className={classes.listItem}>
              <ListItemIcon className={classes.importIcon}>
                {getFieldIcon(field)}
              </ListItemIcon>
              <ListItemText primary={field} />
            </ListItem>
          ))}
        </List>

        {state.preview.fieldsToImport.length === 0 && (
          <Alert severity="info">
            No data found to import from the selected file.
          </Alert>
        )}

        <Divider className={classes.section} />

        <Box
          className={classes.expandButton}
          onClick={() => setShowSkipped(!showSkipped)}
        >
          <Typography variant="subtitle1">
            Data Skipped (Dollar Amounts)
          </Typography>
          {showSkipped ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </Box>
        <Collapse in={showSkipped}>
          <List dense>
            {state.preview.fieldsSkipped.map((field, idx) => (
              <ListItem key={idx} className={classes.listItem}>
                <ListItemIcon className={classes.skipIcon}>
                  <CancelIcon />
                </ListItemIcon>
                <ListItemText
                  primary={field}
                  secondary="Income amounts are not imported"
                />
              </ListItem>
            ))}
          </List>
        </Collapse>

        {state.step === 'importing' && (
          <Box className={classes.progressContainer}>
            <Typography variant="body2" color="textSecondary">
              Importing data...
            </Typography>
            <LinearProgress variant="determinate" value={state.progress} />
          </Box>
        )}

        {state.step === 'complete' && (
          <Alert severity="success" className={classes.section}>
            <AlertTitle>Import Complete</AlertTitle>
            Your prior year data has been successfully imported. You can now
            update the income amounts for the current tax year.
          </Alert>
        )}

        {state.step === 'error' && (
          <Alert severity="error" className={classes.section}>
            <AlertTitle>Import Failed</AlertTitle>
            {state.error}
          </Alert>
        )}

        <Box className={classes.buttonContainer}>
          {state.step === 'previewing' && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleImport}
              disabled={state.preview.fieldsToImport.length === 0}
            >
              Import Data
            </Button>
          )}
          <Button
            variant={state.step === 'complete' ? 'contained' : 'outlined'}
            color={state.step === 'complete' ? 'primary' : 'default'}
            onClick={handleReset}
          >
            {state.step === 'complete' ? 'Done' : 'Cancel'}
          </Button>
        </Box>
      </Paper>
    )
  }

  return (
    <div className={classes.root}>
      <Typography variant="h5" gutterBottom>
        Import Prior Year Data
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Import structural data from a previous tax year to save time. This
        feature imports names, addresses, employer information, and bank
        details, but does not import income amounts which change year to year.
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          {renderFilePicker()}
          {renderYearSelection()}
          {renderPreview()}
        </Grid>
      </Grid>
    </div>
  )
}

export default PriorYearImport
