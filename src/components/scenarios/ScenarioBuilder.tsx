/**
 * ScenarioBuilder Component
 *
 * Allows users to:
 * - Clone current tax data as starting point
 * - Modify any field (income, deductions, credits)
 * - Quick adjustments: "Add $X income", "Increase 401k by $Y"
 * - Real-time recalculation preview
 */

import { ReactElement, useState, useCallback, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  TextField,
  Button,
  IconButton,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Chip,
  InputAdornment,
  Collapse,
  makeStyles,
  createStyles,
  Theme
} from '@material-ui/core'
import {
  Add,
  Delete,
  Edit,
  Save,
  ExpandMore,
  ExpandLess,
  Refresh
} from '@material-ui/icons'
import { useSelector } from 'react-redux'
import { YearsTaxesState } from 'ustaxes/redux'
import { Information, TaxYear, Asset, FilingStatus } from 'ustaxes/core/data'
import {
  Scenario,
  ScenarioModification,
  ModificationType,
  TaxCalculationResult,
  applyModifications,
  calculateTaxes,
  generateScenarioId
} from 'ustaxes/core/scenarios/scenarioEngine'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: '100%'
    },
    card: {
      marginBottom: theme.spacing(2)
    },
    modificationList: {
      maxHeight: 300,
      overflow: 'auto'
    },
    modificationItem: {
      borderBottom: `1px solid ${theme.palette.divider}`
    },
    addSection: {
      backgroundColor: theme.palette.grey[50],
      padding: theme.spacing(2),
      borderRadius: theme.shape.borderRadius
    },
    previewSection: {
      backgroundColor: theme.palette.primary.light + '10',
      padding: theme.spacing(2),
      borderRadius: theme.shape.borderRadius,
      marginTop: theme.spacing(2)
    },
    positiveValue: {
      color: theme.palette.success.main
    },
    negativeValue: {
      color: theme.palette.error.main
    },
    formControl: {
      minWidth: 200,
      marginRight: theme.spacing(2)
    },
    valueInput: {
      width: 150
    },
    chipContainer: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(2)
    }
  })
)

interface ScenarioBuilderProps {
  scenario: Scenario
  onSave: (scenario: Scenario) => void
  onCancel: () => void
}

/**
 * Modification type options with labels
 */
const modificationTypes: { value: ModificationType; label: string }[] = [
  { value: 'ADD_INCOME', label: 'Add Additional Income' },
  { value: 'MODIFY_INCOME', label: 'Set Income Amount' },
  { value: 'ADD_401K_CONTRIBUTION', label: 'Add 401(k) Contribution' },
  { value: 'ADD_HSA_CONTRIBUTION', label: 'Add HSA Contribution' },
  { value: 'ADD_IRA_CONTRIBUTION', label: 'Add IRA Contribution' },
  { value: 'ADD_DEPENDENT', label: 'Add Dependent' },
  { value: 'ADD_SPOUSE', label: 'Add Spouse' },
  { value: 'CHANGE_FILING_STATUS', label: 'Change Filing Status' },
  { value: 'ADD_ITEMIZED_DEDUCTION', label: 'Add Itemized Deduction' }
]

/**
 * Filing status options
 */
const filingStatusOptions = [
  { value: FilingStatus.S, label: 'Single' },
  { value: FilingStatus.MFJ, label: 'Married Filing Jointly' },
  { value: FilingStatus.MFS, label: 'Married Filing Separately' },
  { value: FilingStatus.HOH, label: 'Head of Household' },
  { value: FilingStatus.W, label: 'Qualifying Widow(er)' }
]

/**
 * Itemized deduction field options
 */
const itemizedDeductionFields = [
  { value: 'medicalAndDental', label: 'Medical and Dental' },
  { value: 'stateAndLocalTaxes', label: 'State and Local Taxes' },
  { value: 'stateAndLocalRealEstateTaxes', label: 'Real Estate Taxes' },
  { value: 'interest8a', label: 'Mortgage Interest (Form 1098)' },
  { value: 'charityCashCheck', label: 'Charitable Contributions (Cash)' },
  { value: 'charityOther', label: 'Charitable Contributions (Other)' }
]

/**
 * Format currency for display
 */
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const ScenarioBuilder = ({
  scenario,
  onSave,
  onCancel
}: ScenarioBuilderProps): ReactElement => {
  const classes = useStyles()

  // Get current tax data from Redux
  const activeYear: TaxYear = useSelector(
    (state: YearsTaxesState) => state.activeYear
  )
  const currentInfo: Information = useSelector(
    (state: YearsTaxesState) => state[state.activeYear]
  )
  const assets: Asset<Date>[] = useSelector(
    (state: YearsTaxesState) => state.assets
  )

  // Local state
  const [name, setName] = useState(scenario.name)
  const [description, setDescription] = useState(scenario.description ?? '')
  const [modifications, setModifications] = useState<ScenarioModification[]>(
    scenario.modifications
  )
  const [showAddForm, setShowAddForm] = useState(false)
  const [previewResult, setPreviewResult] =
    useState<TaxCalculationResult | null>(null)
  const [baselineResult, setBaselineResult] =
    useState<TaxCalculationResult | null>(null)

  // New modification form state
  const [newModType, setNewModType] = useState<ModificationType>('ADD_INCOME')
  const [newModValue, setNewModValue] = useState<string>('')
  const [newModFieldPath, setNewModFieldPath] = useState<string>('')
  const [newModLabel, setNewModLabel] = useState<string>('')

  // Dependent form fields
  const [depFirstName, setDepFirstName] = useState('')
  const [depLastName, setDepLastName] = useState('')
  const [depRelationship, setDepRelationship] = useState('Son/Daughter')

  // Spouse form fields
  const [spouseFirstName, setSpouseFirstName] = useState('')
  const [spouseLastName, setSpouseLastName] = useState('')
  const [spouseIncome, setSpouseIncome] = useState<string>('')

  // Calculate baseline on mount
  useEffect(() => {
    const result = calculateTaxes(
      activeYear,
      currentInfo,
      assets,
      'baseline',
      'Current',
      true
    )
    setBaselineResult(result)
  }, [activeYear, currentInfo, assets])

  // Recalculate preview when modifications change
  useEffect(() => {
    if (modifications.length > 0) {
      const modifiedInfo = applyModifications(currentInfo, modifications)
      const result = calculateTaxes(
        activeYear,
        modifiedInfo,
        assets,
        scenario.id,
        name,
        false
      )
      setPreviewResult(result)
    } else {
      setPreviewResult(null)
    }
  }, [modifications, currentInfo, assets, activeYear, scenario.id, name])

  /**
   * Add a new modification
   */
  const handleAddModification = useCallback(() => {
    let value: number | string | object = 0
    let label = ''

    switch (newModType) {
      case 'ADD_INCOME':
      case 'MODIFY_INCOME':
      case 'ADD_401K_CONTRIBUTION':
      case 'ADD_HSA_CONTRIBUTION':
      case 'ADD_IRA_CONTRIBUTION':
      case 'ADD_ITEMIZED_DEDUCTION':
        value = parseFloat(newModValue) || 0
        label =
          newModLabel ||
          modificationTypes.find((t) => t.value === newModType)?.label ||
          ''
        break

      case 'ADD_DEPENDENT':
        value = {
          firstName: depFirstName,
          lastName: depLastName,
          relationship: depRelationship,
          dateOfBirth: new Date(new Date().getFullYear() - 5, 0, 1)
        }
        label = `Add dependent: ${depFirstName} ${depLastName}`
        break

      case 'ADD_SPOUSE':
        value = {
          firstName: spouseFirstName,
          lastName: spouseLastName,
          dateOfBirth: new Date(1985, 0, 1),
          income: parseFloat(spouseIncome) || 0
        }
        label = `Add spouse: ${spouseFirstName} ${spouseLastName}`
        break

      case 'CHANGE_FILING_STATUS':
        value = newModValue as FilingStatus
        label = `Change filing status to ${filingStatusOptions.find((o) => o.value === newModValue)?.label || newModValue}`
        break
    }

    const newMod: ScenarioModification = {
      id: `mod_${Date.now()}`,
      type: newModType,
      label,
      value,
      fieldPath: newModFieldPath || undefined
    }

    setModifications([...modifications, newMod])
    resetAddForm()
  }, [
    newModType,
    newModValue,
    newModLabel,
    newModFieldPath,
    depFirstName,
    depLastName,
    depRelationship,
    spouseFirstName,
    spouseLastName,
    spouseIncome,
    modifications
  ])

  /**
   * Remove a modification
   */
  const handleRemoveModification = useCallback(
    (modId: string) => {
      setModifications(modifications.filter((m) => m.id !== modId))
    },
    [modifications]
  )

  /**
   * Reset add form
   */
  const resetAddForm = () => {
    setNewModType('ADD_INCOME')
    setNewModValue('')
    setNewModFieldPath('')
    setNewModLabel('')
    setDepFirstName('')
    setDepLastName('')
    setDepRelationship('Son/Daughter')
    setSpouseFirstName('')
    setSpouseLastName('')
    setSpouseIncome('')
    setShowAddForm(false)
  }

  /**
   * Save the scenario
   */
  const handleSave = useCallback(() => {
    const updatedScenario: Scenario = {
      ...scenario,
      name,
      description,
      modifications,
      modifiedAt: new Date()
    }
    onSave(updatedScenario)
  }, [scenario, name, description, modifications, onSave])

  /**
   * Render the add modification form based on type
   */
  const renderAddForm = (): ReactElement => {
    switch (newModType) {
      case 'ADD_INCOME':
      case 'MODIFY_INCOME':
      case 'ADD_401K_CONTRIBUTION':
      case 'ADD_HSA_CONTRIBUTION':
      case 'ADD_IRA_CONTRIBUTION':
        return (
          <TextField
            label="Amount"
            type="number"
            value={newModValue}
            onChange={(e) => setNewModValue(e.target.value)}
            className={classes.valueInput}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">$</InputAdornment>
              )
            }}
          />
        )

      case 'ADD_DEPENDENT':
        return (
          <Grid container spacing={2}>
            <Grid item>
              <TextField
                label="First Name"
                value={depFirstName}
                onChange={(e) => setDepFirstName(e.target.value)}
              />
            </Grid>
            <Grid item>
              <TextField
                label="Last Name"
                value={depLastName}
                onChange={(e) => setDepLastName(e.target.value)}
              />
            </Grid>
            <Grid item>
              <FormControl className={classes.formControl}>
                <InputLabel>Relationship</InputLabel>
                <Select
                  value={depRelationship}
                  onChange={(e) => setDepRelationship(e.target.value as string)}
                >
                  <MenuItem value="Son/Daughter">Son/Daughter</MenuItem>
                  <MenuItem value="Stepchild">Stepchild</MenuItem>
                  <MenuItem value="Foster Child">Foster Child</MenuItem>
                  <MenuItem value="Grandchild">Grandchild</MenuItem>
                  <MenuItem value="Sibling">Sibling</MenuItem>
                  <MenuItem value="Parent">Parent</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        )

      case 'ADD_SPOUSE':
        return (
          <Grid container spacing={2}>
            <Grid item>
              <TextField
                label="First Name"
                value={spouseFirstName}
                onChange={(e) => setSpouseFirstName(e.target.value)}
              />
            </Grid>
            <Grid item>
              <TextField
                label="Last Name"
                value={spouseLastName}
                onChange={(e) => setSpouseLastName(e.target.value)}
              />
            </Grid>
            <Grid item>
              <TextField
                label="Income (optional)"
                type="number"
                value={spouseIncome}
                onChange={(e) => setSpouseIncome(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  )
                }}
              />
            </Grid>
          </Grid>
        )

      case 'CHANGE_FILING_STATUS':
        return (
          <FormControl className={classes.formControl}>
            <InputLabel>Filing Status</InputLabel>
            <Select
              value={newModValue}
              onChange={(e) => setNewModValue(e.target.value as string)}
            >
              {filingStatusOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )

      case 'ADD_ITEMIZED_DEDUCTION':
        return (
          <Grid container spacing={2}>
            <Grid item>
              <FormControl className={classes.formControl}>
                <InputLabel>Deduction Type</InputLabel>
                <Select
                  value={newModFieldPath}
                  onChange={(e) => setNewModFieldPath(e.target.value as string)}
                >
                  {itemizedDeductionFields.map((field) => (
                    <MenuItem key={field.value} value={field.value}>
                      {field.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item>
              <TextField
                label="Amount"
                type="number"
                value={newModValue}
                onChange={(e) => setNewModValue(e.target.value)}
                className={classes.valueInput}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  )
                }}
              />
            </Grid>
          </Grid>
        )

      default:
        return <></>
    }
  }

  /**
   * Render preview comparison
   */
  const renderPreview = (): ReactElement | null => {
    if (!baselineResult || !previewResult) return null

    const taxDiff = previewResult.totalTax - baselineResult.totalTax
    const refundDiff =
      previewResult.refundAmount -
      previewResult.amountOwed -
      (baselineResult.refundAmount - baselineResult.amountOwed)

    return (
      <Box className={classes.previewSection}>
        <Typography variant="h6" gutterBottom>
          <Refresh style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Real-Time Preview
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={6} md={3}>
            <Typography variant="body2" color="textSecondary">
              Current Tax
            </Typography>
            <Typography variant="h6">
              {formatCurrency(baselineResult.totalTax)}
            </Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="body2" color="textSecondary">
              Scenario Tax
            </Typography>
            <Typography variant="h6">
              {formatCurrency(previewResult.totalTax)}
            </Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="body2" color="textSecondary">
              Tax Difference
            </Typography>
            <Typography
              variant="h6"
              className={taxDiff <= 0 ? classes.positiveValue : classes.negativeValue}
            >
              {taxDiff > 0 ? '+' : ''}
              {formatCurrency(taxDiff)}
            </Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="body2" color="textSecondary">
              Refund Impact
            </Typography>
            <Typography
              variant="h6"
              className={refundDiff >= 0 ? classes.positiveValue : classes.negativeValue}
            >
              {refundDiff > 0 ? '+' : ''}
              {formatCurrency(refundDiff)}
            </Typography>
          </Grid>
        </Grid>
      </Box>
    )
  }

  return (
    <Box className={classes.root}>
      <Card className={classes.card}>
        <CardHeader title="Scenario Details" />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Scenario Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card className={classes.card}>
        <CardHeader
          title="Modifications"
          subheader={`${modifications.length} modification(s)`}
          action={
            <Button
              startIcon={<Add />}
              onClick={() => setShowAddForm(!showAddForm)}
              color="primary"
            >
              Add Modification
            </Button>
          }
        />
        <CardContent>
          {/* Quick modification chips */}
          <Box className={classes.chipContainer}>
            <Chip
              label="Add $10,000 Income"
              onClick={() => {
                const mod: ScenarioModification = {
                  id: `mod_${Date.now()}`,
                  type: 'ADD_INCOME',
                  label: 'Add $10,000 Income',
                  value: 10000
                }
                setModifications([...modifications, mod])
              }}
              variant="outlined"
              color="primary"
            />
            <Chip
              label="Max 401(k) (+$23,000)"
              onClick={() => {
                const currentContrib =
                  currentInfo.w2s[0]?.box12?.D ?? 0
                const mod: ScenarioModification = {
                  id: `mod_${Date.now()}`,
                  type: 'ADD_401K_CONTRIBUTION',
                  label: 'Max 401(k)',
                  value: Math.max(0, 23000 - currentContrib)
                }
                setModifications([...modifications, mod])
              }}
              variant="outlined"
              color="primary"
            />
            <Chip
              label="Add $5,000 Deduction"
              onClick={() => {
                const mod: ScenarioModification = {
                  id: `mod_${Date.now()}`,
                  type: 'ADD_ITEMIZED_DEDUCTION',
                  label: 'Add $5,000 Charitable',
                  value: 5000,
                  fieldPath: 'charityCashCheck'
                }
                setModifications([...modifications, mod])
              }}
              variant="outlined"
              color="primary"
            />
          </Box>

          {/* Add modification form */}
          <Collapse in={showAddForm}>
            <Box className={classes.addSection} mb={2}>
              <Typography variant="subtitle2" gutterBottom>
                Add New Modification
              </Typography>
              <Grid container spacing={2} alignItems="flex-end">
                <Grid item>
                  <FormControl className={classes.formControl}>
                    <InputLabel>Modification Type</InputLabel>
                    <Select
                      value={newModType}
                      onChange={(e) =>
                        setNewModType(e.target.value as ModificationType)
                      }
                    >
                      {modificationTypes.map((type) => (
                        <MenuItem key={type.value} value={type.value}>
                          {type.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item>{renderAddForm()}</Grid>
                <Grid item>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleAddModification}
                    startIcon={<Add />}
                  >
                    Add
                  </Button>
                </Grid>
                <Grid item>
                  <Button onClick={resetAddForm}>Cancel</Button>
                </Grid>
              </Grid>
            </Box>
          </Collapse>

          {/* Modifications list */}
          {modifications.length > 0 ? (
            <List className={classes.modificationList}>
              {modifications.map((mod, idx) => (
                <ListItem key={mod.id} className={classes.modificationItem}>
                  <ListItemText
                    primary={mod.label}
                    secondary={
                      typeof mod.value === 'number'
                        ? formatCurrency(mod.value)
                        : typeof mod.value === 'string'
                          ? mod.value
                          : JSON.stringify(mod.value)
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleRemoveModification(mod.id)}
                    >
                      <Delete />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography color="textSecondary">
              No modifications added yet. Add modifications to see how they
              affect your taxes.
            </Typography>
          )}

          {/* Real-time preview */}
          {renderPreview()}
        </CardContent>
      </Card>

      {/* Action buttons */}
      <Box display="flex" justifyContent="flex-end" mt={2}>
        <Button onClick={onCancel} style={{ marginRight: 8 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          startIcon={<Save />}
          disabled={!name.trim()}
        >
          Save Scenario
        </Button>
      </Box>
    </Box>
  )
}

export default ScenarioBuilder
