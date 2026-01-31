/**
 * Interview Wizard Component
 * Main wizard component with step-by-step question flow,
 * progress indicator, and navigation
 */

import { ReactElement, useEffect } from 'react'
import { Helmet } from 'react-helmet'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Container,
  Grid,
  LinearProgress,
  Paper,
  Step,
  StepButton,
  StepLabel,
  Stepper,
  Typography,
  useMediaQuery,
  Fade,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip
} from '@material-ui/core'
import {
  createStyles,
  makeStyles,
  Theme,
  useTheme
} from '@material-ui/core/styles'
import {
  ArrowBack,
  ArrowForward,
  Check,
  CheckCircle,
  RadioButtonUnchecked,
  SkipNext,
  Replay,
  Description
} from '@material-ui/icons'
import { InterviewProvider, useInterview } from './InterviewContext'
import InterviewQuestion from './InterviewQuestion'
import { interviewSteps, getCategoryById } from './interviewFlow'
import Urls from 'ustaxes/data/urls'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      minHeight: '100vh',
      backgroundColor: theme.palette.background.default,
      paddingTop: theme.spacing(3),
      paddingBottom: theme.spacing(6)
    },
    header: {
      marginBottom: theme.spacing(4),
      textAlign: 'center'
    },
    title: {
      fontSize: '2rem',
      fontWeight: 600,
      color: theme.palette.text.primary,
      marginBottom: theme.spacing(1)
    },
    subtitle: {
      color: theme.palette.text.secondary,
      fontSize: '1.1rem'
    },
    progressContainer: {
      marginBottom: theme.spacing(4)
    },
    progressBar: {
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.palette.grey[200]
    },
    progressBarFill: {
      borderRadius: 4
    },
    progressText: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: theme.spacing(1),
      color: theme.palette.text.secondary,
      fontSize: '0.875rem'
    },
    stepperContainer: {
      marginBottom: theme.spacing(4)
    },
    stepper: {
      backgroundColor: 'transparent',
      padding: 0,
      [theme.breakpoints.down('sm')]: {
        display: 'none'
      }
    },
    mobileStepIndicator: {
      display: 'none',
      [theme.breakpoints.down('sm')]: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing(3),
        gap: theme.spacing(1)
      }
    },
    stepDot: {
      width: 10,
      height: 10,
      borderRadius: '50%',
      backgroundColor: theme.palette.grey[300],
      transition: 'all 0.2s ease'
    },
    stepDotActive: {
      backgroundColor: theme.palette.primary.main,
      transform: 'scale(1.3)'
    },
    stepDotCompleted: {
      backgroundColor: theme.palette.success.main
    },
    stepContent: {
      marginBottom: theme.spacing(4)
    },
    stepTitle: {
      fontSize: '1.5rem',
      fontWeight: 600,
      marginBottom: theme.spacing(1)
    },
    stepDescription: {
      color: theme.palette.text.secondary,
      marginBottom: theme.spacing(3)
    },
    questionContainer: {
      maxWidth: 700,
      margin: '0 auto'
    },
    navigationContainer: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: theme.spacing(4),
      paddingTop: theme.spacing(3),
      borderTop: `1px solid ${theme.palette.divider}`
    },
    navButton: {
      padding: theme.spacing(1.5, 4),
      borderRadius: theme.spacing(1),
      textTransform: 'none',
      fontSize: '1rem',
      fontWeight: 500
    },
    skipButton: {
      color: theme.palette.text.secondary
    },
    sidebarContainer: {
      [theme.breakpoints.down('md')]: {
        display: 'none'
      }
    },
    sidebar: {
      position: 'sticky',
      top: theme.spacing(3),
      padding: theme.spacing(3),
      borderRadius: theme.spacing(2),
      backgroundColor: theme.palette.background.paper,
      boxShadow: '0 2px 10px rgba(0,0,0,0.08)'
    },
    sidebarTitle: {
      fontSize: '1rem',
      fontWeight: 600,
      marginBottom: theme.spacing(2)
    },
    sidebarList: {
      padding: 0
    },
    sidebarListItem: {
      padding: theme.spacing(1, 0),
      cursor: 'pointer',
      borderRadius: theme.spacing(1),
      '&:hover': {
        backgroundColor: theme.palette.action.hover
      }
    },
    sidebarListItemActive: {
      backgroundColor: theme.palette.primary.light + '20'
    },
    categoryChip: {
      marginRight: theme.spacing(1)
    },
    completeContainer: {
      textAlign: 'center',
      padding: theme.spacing(6)
    },
    completeIcon: {
      fontSize: 80,
      color: theme.palette.success.main,
      marginBottom: theme.spacing(3)
    },
    completeTitle: {
      fontSize: '2rem',
      fontWeight: 600,
      marginBottom: theme.spacing(2)
    },
    completeSubtitle: {
      color: theme.palette.text.secondary,
      marginBottom: theme.spacing(4),
      fontSize: '1.1rem'
    },
    actionButtons: {
      display: 'flex',
      justifyContent: 'center',
      gap: theme.spacing(2),
      flexWrap: 'wrap'
    }
  })
)

// Internal wizard content (uses context)
function InterviewWizardContent(): ReactElement {
  const classes = useStyles()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const navigate = useNavigate()

  const {
    state,
    currentStep,
    currentQuestion,
    visibleQuestions,
    progress,
    totalSteps,
    nextQuestion,
    previousQuestion,
    goToStep,
    canGoBack,
    isStepCompleted,
    reset,
    getAnswer
  } = useInterview()

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && currentQuestion) {
        const answer = getAnswer(currentQuestion.id)
        if (answer !== undefined && answer !== '') {
          nextQuestion()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentQuestion, getAnswer, nextQuestion])

  const handleGoToForms = () => {
    navigate(Urls.taxPayer.info)
  }

  const handleReviewPDF = () => {
    navigate(Urls.createPdf)
  }

  // Completed state
  if (state.isComplete) {
    return (
      <Container maxWidth="md">
        <Box className={classes.completeContainer}>
          <CheckCircle className={classes.completeIcon} />
          <Typography className={classes.completeTitle}>
            Interview Complete!
          </Typography>
          <Typography className={classes.completeSubtitle}>
            You have answered all the questions. Your responses have been saved
            and will help pre-fill your tax forms.
          </Typography>
          <Box className={classes.actionButtons}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<Description />}
              onClick={handleGoToForms}
              className={classes.navButton}
            >
              Continue to Tax Forms
            </Button>
            <Button
              variant="outlined"
              color="primary"
              size="large"
              startIcon={<Description />}
              onClick={handleReviewPDF}
              className={classes.navButton}
            >
              Review & Print
            </Button>
            <Button
              variant="text"
              startIcon={<Replay />}
              onClick={reset}
              className={classes.navButton}
            >
              Start Over
            </Button>
          </Box>
        </Box>
      </Container>
    )
  }

  if (!currentStep || !currentQuestion) {
    return (
      <Container maxWidth="md">
        <Typography>Loading...</Typography>
      </Container>
    )
  }

  const category = getCategoryById(currentStep.category)
  const questionNumber = state.currentQuestionIndex + 1
  const totalQuestionsInStep = visibleQuestions.length

  return (
    <Box className={classes.root}>
      <Container maxWidth="lg">
        <Helmet>
          <title>Tax Interview | UsTaxes.org</title>
        </Helmet>

        {/* Header */}
        <Box className={classes.header}>
          <Typography className={classes.title}>
            Tax Return Interview
          </Typography>
          <Typography className={classes.subtitle}>
            Answer these questions to help us prepare your tax return
          </Typography>
        </Box>

        {/* Progress Bar */}
        <Box className={classes.progressContainer}>
          <LinearProgress
            variant="determinate"
            value={progress}
            className={classes.progressBar}
            classes={{ bar: classes.progressBarFill }}
          />
          <Box className={classes.progressText}>
            <span>{progress}% complete</span>
            <span>
              Step {state.currentStepIndex + 1} of {totalSteps}
            </span>
          </Box>
        </Box>

        <Grid container spacing={4}>
          {/* Main Content */}
          <Grid item xs={12} lg={9}>
            {/* Stepper */}
            <Box className={classes.stepperContainer}>
              <Stepper
                activeStep={state.currentStepIndex}
                alternativeLabel
                nonLinear
                className={classes.stepper}
              >
                {interviewSteps.map((step, index) => {
                  const completed = isStepCompleted(step.id)
                  return (
                    <Step key={step.id} completed={completed}>
                      <StepButton onClick={() => goToStep(index)}>
                        <StepLabel
                          StepIconComponent={() =>
                            completed ? (
                              <Check
                                style={{ color: theme.palette.success.main }}
                              />
                            ) : index === state.currentStepIndex ? (
                              <RadioButtonUnchecked color="primary" />
                            ) : (
                              <RadioButtonUnchecked
                                style={{ color: theme.palette.grey[400] }}
                              />
                            )
                          }
                        >
                          {step.title}
                        </StepLabel>
                      </StepButton>
                    </Step>
                  )
                })}
              </Stepper>

              {/* Mobile Step Indicator */}
              <Box className={classes.mobileStepIndicator}>
                {interviewSteps.map((step, index) => (
                  <Box
                    key={step.id}
                    className={`${classes.stepDot} ${
                      index === state.currentStepIndex
                        ? classes.stepDotActive
                        : isStepCompleted(step.id)
                        ? classes.stepDotCompleted
                        : ''
                    }`}
                    onClick={() => goToStep(index)}
                  />
                ))}
              </Box>
            </Box>

            {/* Step Header */}
            <Fade in={true} key={currentStep.id}>
              <Box className={classes.stepContent}>
                <Box display="flex" alignItems="center" marginBottom={1}>
                  {category && (
                    <Chip
                      label={category.title}
                      size="small"
                      color="primary"
                      variant="outlined"
                      className={classes.categoryChip}
                    />
                  )}
                  <Typography variant="body2" color="textSecondary">
                    Question {questionNumber} of {totalQuestionsInStep}
                  </Typography>
                </Box>
                <Typography className={classes.stepTitle}>
                  {currentStep.title}
                </Typography>
                <Typography className={classes.stepDescription}>
                  {currentStep.description}
                </Typography>
              </Box>
            </Fade>

            {/* Current Question */}
            <Box className={classes.questionContainer}>
              <InterviewQuestion
                key={currentQuestion.id}
                question={currentQuestion}
              />

              {/* Navigation */}
              <Box className={classes.navigationContainer}>
                <Button
                  className={classes.navButton}
                  startIcon={<ArrowBack />}
                  onClick={previousQuestion}
                  disabled={!canGoBack()}
                >
                  {isMobile ? 'Back' : 'Previous'}
                </Button>

                <Box>
                  {!currentQuestion.required && (
                    <Button
                      className={`${classes.navButton} ${classes.skipButton}`}
                      endIcon={<SkipNext />}
                      onClick={nextQuestion}
                    >
                      Skip
                    </Button>
                  )}
                </Box>

                <Button
                  variant="contained"
                  color="primary"
                  className={classes.navButton}
                  endIcon={<ArrowForward />}
                  onClick={nextQuestion}
                >
                  {isMobile ? 'Next' : 'Continue'}
                </Button>
              </Box>
            </Box>
          </Grid>

          {/* Sidebar - Desktop Only */}
          <Grid item lg={3} className={classes.sidebarContainer}>
            <Paper className={classes.sidebar} elevation={0}>
              <Typography className={classes.sidebarTitle}>
                Interview Progress
              </Typography>
              <Divider style={{ marginBottom: 16 }} />
              <List className={classes.sidebarList}>
                {interviewSteps.map((step, index) => {
                  const isActive = index === state.currentStepIndex
                  const completed = isStepCompleted(step.id)

                  return (
                    <ListItem
                      key={step.id}
                      className={`${classes.sidebarListItem} ${
                        isActive ? classes.sidebarListItemActive : ''
                      }`}
                      onClick={() => goToStep(index)}
                    >
                      <ListItemIcon style={{ minWidth: 36 }}>
                        {completed ? (
                          <CheckCircle
                            fontSize="small"
                            style={{ color: theme.palette.success.main }}
                          />
                        ) : isActive ? (
                          <RadioButtonUnchecked
                            fontSize="small"
                            color="primary"
                          />
                        ) : (
                          <RadioButtonUnchecked
                            fontSize="small"
                            style={{ color: theme.palette.grey[400] }}
                          />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={step.title}
                        primaryTypographyProps={{
                          variant: 'body2',
                          style: {
                            fontWeight: isActive ? 600 : 400,
                            color: isActive
                              ? theme.palette.primary.main
                              : theme.palette.text.primary
                          }
                        }}
                      />
                    </ListItem>
                  )
                })}
              </List>

              {/* Quick Stats */}
              <Divider style={{ margin: '16px 0' }} />
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Questions Answered
              </Typography>
              <Typography variant="h6" color="primary">
                {Object.keys(state.answers).length}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}

// Main export with provider
export default function InterviewWizard(): ReactElement {
  return (
    <InterviewProvider>
      <InterviewWizardContent />
    </InterviewProvider>
  )
}

// Export a minimal entry point that can be used in menu
export function InterviewWizardEntry(): ReactElement {
  return <InterviewWizard />
}
