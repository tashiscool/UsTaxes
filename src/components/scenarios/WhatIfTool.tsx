/**
 * WhatIfTool Component
 *
 * Main UI for the What-If Scenario analysis tool:
 * - Create/save/load scenarios
 * - Compare up to 3 scenarios side-by-side
 * - Visual diff of tax outcomes
 * - "Current" baseline always shown
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { ReactElement, useState, useCallback, useEffect, useMemo } from 'react'
import { Helmet } from 'react-helmet'
import {
  Box,
  Typography,
  Button,
  Paper,
  Tabs,
  Tab,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Checkbox,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Snackbar,
  makeStyles,
  createStyles,
  Theme
} from '@material-ui/core'
import {
  Add,
  Delete,
  Edit,
  FileCopy,
  CompareArrows,
  Assessment,
  EmojiObjects,
  Save,
  FolderOpen,
  Warning
} from '@material-ui/icons'
import { Alert } from '@material-ui/lab'
import { useSelector } from 'react-redux'
import { YearsTaxesState } from 'ustaxes/redux'
import { Information, TaxYear, Asset } from 'ustaxes/core/data'

import {
  Scenario,
  TaxCalculationResult,
  ScenarioComparison as ScenarioComparisonType,
  compareScenarios,
  createEmptyScenario,
  generateScenarioId,
  calculateTaxes
} from 'ustaxes/core/scenarios/scenarioEngine'
import ScenarioBuilder from './ScenarioBuilder'
import ScenarioComparison from './ScenarioComparison'
import QuickScenarios from './QuickScenarios'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: '100%',
      padding: theme.spacing(2)
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing(3)
    },
    tabs: {
      marginBottom: theme.spacing(3)
    },
    tabPanel: {
      padding: theme.spacing(2, 0)
    },
    scenarioList: {
      maxHeight: 400,
      overflow: 'auto',
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: theme.shape.borderRadius
    },
    scenarioItem: {
      borderBottom: `1px solid ${theme.palette.divider}`,
      '&:last-child': {
        borderBottom: 'none'
      }
    },
    selectedScenario: {
      backgroundColor: theme.palette.action.selected
    },
    actionButton: {
      marginRight: theme.spacing(1)
    },
    compareButton: {
      marginTop: theme.spacing(2)
    },
    loadingContainer: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 200
    },
    emptyState: {
      textAlign: 'center',
      padding: theme.spacing(4),
      color: theme.palette.text.secondary
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: theme.spacing(2),
      color: theme.palette.action.disabled
    },
    baselineChip: {
      marginLeft: theme.spacing(1)
    },
    modificationCount: {
      marginLeft: theme.spacing(1)
    },
    sectionTitle: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: theme.spacing(2)
    },
    sectionIcon: {
      marginRight: theme.spacing(1),
      color: theme.palette.primary.main
    }
  })
)

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel = ({
  children,
  value,
  index
}: TabPanelProps): ReactElement | null => {
  if (value !== index) return null
  return <Box>{children}</Box>
}

const WhatIfTool = (): ReactElement => {
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

  // Local state for scenarios (could be moved to Redux)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([])
  const [comparison, setComparison] = useState<ScenarioComparisonType | null>(
    null
  )

  // UI state
  const [activeTab, setActiveTab] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [scenarioToDelete, setScenarioToDelete] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error' | 'info'
  }>({
    open: false,
    message: '',
    severity: 'info'
  })

  // Baseline calculation
  const [baseline, setBaseline] = useState<TaxCalculationResult | null>(null)

  // Calculate baseline on mount and when tax data changes
  useEffect(() => {
    const result = calculateTaxes(
      activeYear,
      currentInfo,
      assets,
      'baseline',
      'Current',
      true
    )
    setBaseline(result)
  }, [activeYear, currentInfo, assets])

  /**
   * Create a new empty scenario
   */
  const handleCreateScenario = useCallback(() => {
    const newScenario = createEmptyScenario(`Scenario ${scenarios.length + 1}`)
    setEditingScenario(newScenario)
    setActiveTab(1) // Switch to builder tab
  }, [scenarios.length])

  /**
   * Add a scenario from quick scenarios
   */
  const handleAddQuickScenario = useCallback((scenario: Scenario) => {
    setScenarios((prev) => [...prev, scenario])
    setSnackbar({
      open: true,
      message: `Created scenario: ${scenario.name}`,
      severity: 'success'
    })
  }, [])

  /**
   * Save edited scenario
   */
  const handleSaveScenario = useCallback((scenario: Scenario) => {
    setScenarios((prev) => {
      const existingIndex = prev.findIndex((s) => s.id === scenario.id)
      if (existingIndex >= 0) {
        // Update existing
        const updated = [...prev]
        updated[existingIndex] = scenario
        return updated
      } else {
        // Add new
        return [...prev, scenario]
      }
    })
    setEditingScenario(null)
    setActiveTab(0) // Back to scenarios tab
    setSnackbar({
      open: true,
      message: 'Scenario saved successfully',
      severity: 'success'
    })
  }, [])

  /**
   * Cancel editing
   */
  const handleCancelEdit = useCallback(() => {
    setEditingScenario(null)
    setActiveTab(0)
  }, [])

  /**
   * Edit existing scenario
   */
  const handleEditScenario = useCallback((scenario: Scenario) => {
    setEditingScenario(scenario)
    setActiveTab(1)
  }, [])

  /**
   * Duplicate scenario
   */
  const handleDuplicateScenario = useCallback((scenario: Scenario) => {
    const duplicate: Scenario = {
      ...scenario,
      id: generateScenarioId(),
      name: `${scenario.name} (Copy)`,
      createdAt: new Date(),
      modifiedAt: new Date(),
      modifications: [...scenario.modifications]
    }
    setScenarios((prev) => [...prev, duplicate])
    setSnackbar({
      open: true,
      message: 'Scenario duplicated',
      severity: 'success'
    })
  }, [])

  /**
   * Delete scenario
   */
  const handleDeleteScenario = useCallback((scenarioId: string) => {
    setScenarioToDelete(scenarioId)
    setDeleteDialogOpen(true)
  }, [])

  const confirmDeleteScenario = useCallback(() => {
    if (scenarioToDelete) {
      setScenarios((prev) => prev.filter((s) => s.id !== scenarioToDelete))
      setSelectedScenarioIds((prev) =>
        prev.filter((id) => id !== scenarioToDelete)
      )
      setComparison(null)
    }
    setDeleteDialogOpen(false)
    setScenarioToDelete(null)
    setSnackbar({
      open: true,
      message: 'Scenario deleted',
      severity: 'info'
    })
  }, [scenarioToDelete])

  /**
   * Toggle scenario selection for comparison
   */
  const handleToggleSelection = useCallback((scenarioId: string) => {
    setSelectedScenarioIds((prev) => {
      if (prev.includes(scenarioId)) {
        return prev.filter((id) => id !== scenarioId)
      }
      // Limit to 3 scenarios
      if (prev.length >= 3) {
        setSnackbar({
          open: true,
          message: 'You can compare up to 3 scenarios at a time',
          severity: 'info'
        })
        return prev
      }
      return [...prev, scenarioId]
    })
  }, [])

  /**
   * Compare selected scenarios
   */
  const handleCompare = useCallback(() => {
    setIsLoading(true)

    const selectedScenarios = scenarios.filter((s) =>
      selectedScenarioIds.includes(s.id)
    )

    const comparisonResult = compareScenarios(
      activeYear,
      currentInfo,
      assets,
      selectedScenarios
    )

    setComparison(comparisonResult)
    setActiveTab(2) // Switch to comparison tab
    setIsLoading(false)
  }, [scenarios, selectedScenarioIds, activeYear, currentInfo, assets])

  /**
   * Save scenarios to local storage
   */
  const handleSaveToStorage = useCallback(() => {
    try {
      const data = JSON.stringify(scenarios)
      localStorage.setItem(`ustaxes_scenarios_${activeYear}`, data)
      setSnackbar({
        open: true,
        message: 'Scenarios saved to browser',
        severity: 'success'
      })
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to save scenarios',
        severity: 'error'
      })
    }
  }, [scenarios, activeYear])

  /**
   * Load scenarios from local storage
   */
  const handleLoadFromStorage = useCallback(() => {
    try {
      const data = localStorage.getItem(`ustaxes_scenarios_${activeYear}`)
      if (data) {
        const loaded = JSON.parse(data) as Scenario[]
        // Convert date strings back to Date objects
        const restored = loaded.map((s) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          modifiedAt: new Date(s.modifiedAt)
        }))
        setScenarios(restored)
        setSnackbar({
          open: true,
          message: `Loaded ${restored.length} scenarios`,
          severity: 'success'
        })
      } else {
        setSnackbar({
          open: true,
          message: 'No saved scenarios found',
          severity: 'info'
        })
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to load scenarios',
        severity: 'error'
      })
    }
  }, [activeYear])

  // Check if baseline has errors
  const hasBaselineErrors = baseline && !baseline.calculatedSuccessfully

  return (
    <Box className={classes.root}>
      <Helmet>
        <title>What-If Scenarios | UsTaxes.org</title>
      </Helmet>

      {/* Header */}
      <Box className={classes.header}>
        <Box>
          <Typography variant="h4">What-If Scenario Analysis</Typography>
          <Typography variant="body2" color="textSecondary">
            Compare different tax scenarios to optimize your tax situation
          </Typography>
        </Box>
        <Box>
          <Button
            className={classes.actionButton}
            startIcon={<Save />}
            onClick={handleSaveToStorage}
            disabled={scenarios.length === 0}
          >
            Save
          </Button>
          <Button
            className={classes.actionButton}
            startIcon={<FolderOpen />}
            onClick={handleLoadFromStorage}
          >
            Load
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={handleCreateScenario}
          >
            New Scenario
          </Button>
        </Box>
      </Box>

      {/* Baseline warning */}
      {hasBaselineErrors && (
        <Alert severity="warning" style={{ marginBottom: 16 }}>
          <Typography variant="body2">
            There are issues with your current tax data. Scenario comparisons
            may not be accurate.
          </Typography>
        </Alert>
      )}

      {/* Tabs */}
      <Paper className={classes.tabs}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue: number) => setActiveTab(newValue)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Scenarios" icon={<Assessment />} />
          <Tab label="Builder" icon={<Edit />} disabled={!editingScenario} />
          <Tab
            label="Comparison"
            icon={<CompareArrows />}
            disabled={!comparison}
          />
          <Tab label="Quick Scenarios" icon={<EmojiObjects />} />
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      <TabPanel value={activeTab} index={0}>
        {/* Scenarios List */}
        <Box className={classes.sectionTitle}>
          <Assessment className={classes.sectionIcon} />
          <Typography variant="h6">Your Scenarios</Typography>
        </Box>

        {scenarios.length === 0 ? (
          <Paper className={classes.emptyState}>
            <Assessment className={classes.emptyIcon} />
            <Typography variant="h6" gutterBottom>
              No scenarios yet
            </Typography>
            <Typography variant="body2" paragraph>
              Create scenarios to see how changes affect your taxes
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Add />}
              onClick={handleCreateScenario}
              style={{ marginRight: 8 }}
            >
              Create Scenario
            </Button>
            <Button
              variant="outlined"
              startIcon={<EmojiObjects />}
              onClick={() => setActiveTab(3)}
            >
              Browse Quick Scenarios
            </Button>
          </Paper>
        ) : (
          <>
            <List className={classes.scenarioList}>
              {scenarios.map((scenario) => {
                const isSelected = selectedScenarioIds.includes(scenario.id)
                return (
                  <ListItem
                    key={scenario.id}
                    className={`${classes.scenarioItem} ${
                      isSelected ? classes.selectedScenario : ''
                    }`}
                    button
                    onClick={() => handleToggleSelection(scenario.id)}
                  >
                    <ListItemIcon>
                      <Checkbox
                        checked={isSelected}
                        color="primary"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleSelection(scenario.id)
                        }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center">
                          {scenario.name}
                          <Chip
                            size="small"
                            label={`${scenario.modifications.length} changes`}
                            className={classes.modificationCount}
                          />
                        </Box>
                      }
                      secondary={
                        scenario.description ||
                        `Created ${scenario.createdAt.toLocaleDateString()}`
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        size="small"
                        onClick={() => handleEditScenario(scenario)}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDuplicateScenario(scenario)}
                      >
                        <FileCopy />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteScenario(scenario.id)}
                      >
                        <Delete />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                )
              })}
            </List>

            <Box display="flex" justifyContent="space-between" mt={2}>
              <Typography variant="body2" color="textSecondary">
                {selectedScenarioIds.length} of 3 scenarios selected
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<CompareArrows />}
                onClick={handleCompare}
                disabled={selectedScenarioIds.length === 0}
              >
                Compare Selected
              </Button>
            </Box>
          </>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {/* Scenario Builder */}
        {editingScenario && (
          <ScenarioBuilder
            scenario={editingScenario}
            onSave={handleSaveScenario}
            onCancel={handleCancelEdit}
          />
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        {/* Comparison View */}
        {isLoading ? (
          <Box className={classes.loadingContainer}>
            <CircularProgress />
          </Box>
        ) : comparison ? (
          <ScenarioComparison
            baseline={comparison.baseline}
            scenarios={comparison.scenarios}
            differences={comparison.differences}
          />
        ) : (
          <Paper className={classes.emptyState}>
            <CompareArrows className={classes.emptyIcon} />
            <Typography variant="h6">No comparison available</Typography>
            <Typography variant="body2">
              Select scenarios and click &quot;Compare Selected&quot; to see a
              comparison
            </Typography>
          </Paper>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        {/* Quick Scenarios */}
        <QuickScenarios onCreateScenario={handleAddQuickScenario} />
      </TabPanel>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Scenario?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this scenario? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDeleteScenario} color="secondary">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default WhatIfTool
