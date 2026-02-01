/**
 * QuickScenarios Component
 *
 * Pre-built common scenarios for quick analysis:
 * - "What if I max out 401k?"
 * - "What if I itemize instead of standard deduction?"
 * - "What if spouse works?"
 * - "What if I have another child?"
 * - "What if I contribute to HSA?"
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { ReactElement, useState, useMemo } from 'react'
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Chip,
  makeStyles,
  createStyles,
  Theme,
  Tooltip
} from '@material-ui/core'
import {
  AccountBalance,
  ChildCare,
  LocalHospital,
  Home,
  Person,
  AttachMoney,
  TrendingUp,
  School,
  DirectionsCar
} from '@material-ui/icons'
import { useSelector } from 'react-redux'
import { YearsTaxesState } from 'ustaxes/redux'
import { Information, FilingStatus } from 'ustaxes/core/data'
import {
  Scenario,
  ScenarioModification,
  createMax401kScenario,
  createAddChildScenario,
  createMaxHSAScenario,
  createSpouseWorksScenario,
  generateScenarioId
} from 'ustaxes/core/scenarios/scenarioEngine'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: '100%'
    },
    scenarioCard: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: theme.shadows[4]
      }
    },
    cardContent: {
      flexGrow: 1
    },
    iconContainer: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: theme.spacing(2)
    },
    icon: {
      fontSize: 48,
      color: theme.palette.primary.main
    },
    description: {
      color: theme.palette.text.secondary,
      minHeight: 60
    },
    impactChip: {
      marginTop: theme.spacing(1)
    },
    dialogContent: {
      minWidth: 400
    },
    paramInput: {
      marginBottom: theme.spacing(2)
    },
    sectionTitle: {
      marginBottom: theme.spacing(2)
    }
  })
)

interface QuickScenariosProps {
  onCreateScenario: (scenario: Scenario) => void
}

interface QuickScenarioConfig {
  id: string
  title: string
  description: string
  icon: ReactElement
  estimatedImpact?: string
  requiresInput?: boolean
  inputLabel?: string
  inputDefault?: number
  getScenario: (inputValue?: number, currentInfo?: Information) => Scenario
  isApplicable: (info: Information) => boolean
  disabledReason?: (info: Information) => string | null
}

const QuickScenarios = ({
  onCreateScenario
}: QuickScenariosProps): ReactElement => {
  const classes = useStyles()

  // Get current tax data from Redux
  const currentInfo: Information = useSelector(
    (state: YearsTaxesState) => state[state.activeYear]
  )

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedScenario, setSelectedScenario] =
    useState<QuickScenarioConfig | null>(null)
  const [inputValue, setInputValue] = useState<number>(0)

  // Get current 401k contribution
  const current401k = useMemo(() => {
    return currentInfo.w2s.reduce((sum, w2) => sum + (w2.box12?.D ?? 0), 0)
  }, [currentInfo])

  // Get current HSA contribution
  const currentHSA = useMemo(() => {
    return currentInfo.healthSavingsAccounts.reduce(
      (sum, hsa) => sum + hsa.contributions,
      0
    )
  }, [currentInfo])

  // Check if user has family HSA coverage
  const hasFamilyHSA = useMemo(() => {
    return currentInfo.healthSavingsAccounts.some(
      (hsa) => hsa.coverageType === 'family'
    )
  }, [currentInfo])

  // Has spouse already
  const hasSpouse = !!currentInfo.taxPayer.spouse

  // Quick scenario configurations
  const quickScenarios: QuickScenarioConfig[] = useMemo(
    () => [
      {
        id: 'max-401k',
        title: 'Max Out 401(k)',
        description:
          'See the tax impact of contributing the maximum $23,000 to your 401(k) retirement account.',
        icon: <AccountBalance className={classes.icon} />,
        estimatedImpact: 'Reduces taxable income',
        isApplicable: () => true,
        disabledReason: (info) => {
          const current = info.w2s.reduce(
            (sum, w2) => sum + (w2.box12?.D ?? 0),
            0
          )
          return current >= 23000 ? 'Already at maximum contribution' : null
        },
        getScenario: () => createMax401kScenario(current401k)
      },
      {
        id: 'max-hsa',
        title: 'Max Out HSA',
        description:
          'Contribute the maximum to your Health Savings Account ($4,150 individual / $8,300 family).',
        icon: <LocalHospital className={classes.icon} />,
        estimatedImpact: 'Triple tax advantage',
        isApplicable: () => true,
        getScenario: () => createMaxHSAScenario(currentHSA, hasFamilyHSA)
      },
      {
        id: 'add-child',
        title: 'Add Another Child',
        description:
          'See how a new dependent child would affect your taxes, including child tax credit.',
        icon: <ChildCare className={classes.icon} />,
        estimatedImpact: 'Up to $2,000 credit',
        isApplicable: () => true,
        getScenario: () => createAddChildScenario()
      },
      {
        id: 'spouse-works',
        title: 'Spouse Starts Working',
        description:
          'Model the tax impact if your spouse begins earning income. Enter estimated annual income.',
        icon: <Person className={classes.icon} />,
        requiresInput: true,
        inputLabel: 'Spouse Annual Income',
        inputDefault: 50000,
        isApplicable: (info) => !info.taxPayer.spouse,
        disabledReason: (info) =>
          info.taxPayer.spouse ? 'You already have a spouse entered' : null,
        getScenario: (inputValue) =>
          createSpouseWorksScenario(inputValue ?? 50000)
      },
      {
        id: 'itemize-deductions',
        title: 'Itemize Deductions',
        description:
          'Compare itemizing deductions vs. taking the standard deduction.',
        icon: <Home className={classes.icon} />,
        estimatedImpact: 'Varies by deductions',
        requiresInput: true,
        inputLabel: 'Total Itemized Deductions',
        inputDefault: 20000,
        isApplicable: () => true,
        getScenario: (inputValue) => ({
          id: generateScenarioId(),
          name: 'Itemize Deductions',
          description: `Compare with $${(
            inputValue ?? 20000
          ).toLocaleString()} in itemized deductions`,
          modifications: [
            {
              id: 'mod_itemize',
              type: 'ADD_ITEMIZED_DEDUCTION' as const,
              label: 'Total Itemized Deductions',
              value: inputValue ?? 20000,
              fieldPath: 'stateAndLocalTaxes'
            }
          ],
          createdAt: new Date(),
          modifiedAt: new Date()
        })
      },
      {
        id: 'extra-income',
        title: 'Extra Income',
        description:
          'Model the tax impact of additional income (bonus, side gig, investment gains).',
        icon: <AttachMoney className={classes.icon} />,
        estimatedImpact: 'See marginal rate impact',
        requiresInput: true,
        inputLabel: 'Additional Income',
        inputDefault: 10000,
        isApplicable: () => true,
        getScenario: (inputValue) => ({
          id: generateScenarioId(),
          name: `Add $${(inputValue ?? 10000).toLocaleString()} Income`,
          description: 'Additional income scenario',
          modifications: [
            {
              id: 'mod_income',
              type: 'ADD_INCOME' as const,
              label: `Add $${(inputValue ?? 10000).toLocaleString()} Income`,
              value: inputValue ?? 10000
            }
          ],
          createdAt: new Date(),
          modifiedAt: new Date()
        })
      },
      {
        id: 'traditional-ira',
        title: 'Contribute to Traditional IRA',
        description:
          'Contribute to a traditional IRA for potential tax deduction (up to $7,000).',
        icon: <TrendingUp className={classes.icon} />,
        estimatedImpact: 'Up to $7,000 deduction',
        requiresInput: true,
        inputLabel: 'IRA Contribution',
        inputDefault: 7000,
        isApplicable: () => true,
        getScenario: (inputValue) => ({
          id: generateScenarioId(),
          name: 'Traditional IRA Contribution',
          description: `Contribute $${(
            inputValue ?? 7000
          ).toLocaleString()} to Traditional IRA`,
          modifications: [
            {
              id: 'mod_ira',
              type: 'ADD_IRA_CONTRIBUTION' as const,
              label: 'Traditional IRA Contribution',
              value: inputValue ?? 7000
            }
          ],
          createdAt: new Date(),
          modifiedAt: new Date()
        })
      },
      {
        id: 'education-expenses',
        title: 'Education Expenses',
        description:
          'Model tuition and education expenses for potential American Opportunity or Lifetime Learning credits.',
        icon: <School className={classes.icon} />,
        estimatedImpact: 'Up to $2,500 credit',
        requiresInput: true,
        inputLabel: 'Qualified Education Expenses',
        inputDefault: 4000,
        isApplicable: () => true,
        getScenario: (inputValue) => ({
          id: generateScenarioId(),
          name: 'Education Expenses',
          description: `$${(
            inputValue ?? 4000
          ).toLocaleString()} in qualified education expenses`,
          modifications: [
            {
              id: 'mod_edu',
              type: 'CUSTOM_FIELD' as const,
              label: 'Education Expenses',
              value: inputValue ?? 4000,
              fieldPath: 'educationExpenses'
            }
          ],
          createdAt: new Date(),
          modifiedAt: new Date()
        })
      },
      {
        id: 'change-to-hoh',
        title: 'File as Head of Household',
        description:
          'See if filing as Head of Household would reduce your tax liability.',
        icon: <Home className={classes.icon} />,
        estimatedImpact: 'Higher standard deduction',
        isApplicable: (info) =>
          info.taxPayer.filingStatus === FilingStatus.S &&
          info.taxPayer.dependents.length > 0,
        disabledReason: (info) => {
          if (info.taxPayer.filingStatus === FilingStatus.HOH) {
            return 'Already filing as Head of Household'
          }
          if (info.taxPayer.dependents.length === 0) {
            return 'Must have dependents to file as HOH'
          }
          if (info.taxPayer.spouse) {
            return 'Cannot file as HOH when married'
          }
          return null
        },
        getScenario: () => ({
          id: generateScenarioId(),
          name: 'File as Head of Household',
          description: 'Change filing status to Head of Household',
          modifications: [
            {
              id: 'mod_hoh',
              type: 'CHANGE_FILING_STATUS' as const,
              label: 'Change to Head of Household',
              value: FilingStatus.HOH
            }
          ],
          createdAt: new Date(),
          modifiedAt: new Date()
        })
      }
    ],
    [classes.icon, current401k, currentHSA, hasFamilyHSA]
  )

  /**
   * Handle scenario card click
   */
  const handleScenarioClick = (scenario: QuickScenarioConfig) => {
    const disabledReason = scenario.disabledReason?.(currentInfo)
    if (disabledReason) return

    if (scenario.requiresInput) {
      setSelectedScenario(scenario)
      setInputValue(scenario.inputDefault ?? 0)
      setDialogOpen(true)
    } else {
      const newScenario = scenario.getScenario(undefined, currentInfo)
      onCreateScenario(newScenario)
    }
  }

  /**
   * Handle dialog confirm
   */
  const handleDialogConfirm = () => {
    if (selectedScenario) {
      const newScenario = selectedScenario.getScenario(inputValue, currentInfo)
      onCreateScenario(newScenario)
    }
    setDialogOpen(false)
    setSelectedScenario(null)
  }

  return (
    <Box className={classes.root}>
      <Typography variant="h6" className={classes.sectionTitle}>
        Quick Scenarios
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Click on a scenario to instantly create a what-if analysis based on
        common tax planning strategies.
      </Typography>

      <Grid container spacing={3}>
        {quickScenarios.map((scenario) => {
          const disabledReason = scenario.disabledReason?.(currentInfo)
          const isDisabled = !!disabledReason

          return (
            <Grid item xs={12} sm={6} md={4} key={scenario.id}>
              <Tooltip
                title={disabledReason ?? ''}
                arrow
                disableHoverListener={!isDisabled}
              >
                <Card
                  className={classes.scenarioCard}
                  style={{
                    opacity: isDisabled ? 0.6 : 1,
                    cursor: isDisabled ? 'not-allowed' : 'pointer'
                  }}
                  onClick={() => !isDisabled && handleScenarioClick(scenario)}
                >
                  <CardContent className={classes.cardContent}>
                    <Box className={classes.iconContainer}>{scenario.icon}</Box>
                    <Typography variant="h6" align="center" gutterBottom>
                      {scenario.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      className={classes.description}
                      align="center"
                    >
                      {scenario.description}
                    </Typography>
                    {scenario.estimatedImpact && (
                      <Box display="flex" justifyContent="center">
                        <Chip
                          size="small"
                          label={scenario.estimatedImpact}
                          color="primary"
                          variant="outlined"
                          className={classes.impactChip}
                        />
                      </Box>
                    )}
                  </CardContent>
                  <CardActions>
                    <Button
                      fullWidth
                      color="primary"
                      disabled={isDisabled}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleScenarioClick(scenario)
                      }}
                    >
                      Create Scenario
                    </Button>
                  </CardActions>
                </Card>
              </Tooltip>
            </Grid>
          )
        })}
      </Grid>

      {/* Input Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
      >
        <DialogTitle>{selectedScenario?.title}</DialogTitle>
        <DialogContent className={classes.dialogContent}>
          <Typography variant="body2" paragraph>
            {selectedScenario?.description}
          </Typography>
          <TextField
            fullWidth
            label={selectedScenario?.inputLabel ?? 'Amount'}
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(parseFloat(e.target.value) || 0)}
            className={classes.paramInput}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">$</InputAdornment>
              )
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDialogConfirm}
            color="primary"
            variant="contained"
          >
            Create Scenario
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default QuickScenarios
