/**
 * Interview Question Component
 * Individual question component with multiple input types,
 * help text, tooltips, and expandable info
 */

import { ReactElement, useState, ChangeEvent } from 'react'
import {
  Card,
  CardContent,
  Typography,
  FormControl,
  FormControlLabel,
  FormLabel,
  RadioGroup,
  Radio,
  TextField,
  Button,
  Collapse,
  Box,
  IconButton,
  Tooltip,
  InputAdornment,
  FormHelperText,
  Fade,
  Chip
} from '@material-ui/core'
import {
  createStyles,
  makeStyles,
  Theme
} from '@material-ui/core/styles'
import {
  HelpOutline,
  ExpandMore,
  ExpandLess,
  CheckCircle,
  Error as ErrorIcon
} from '@material-ui/icons'
import NumberFormat from 'react-number-format'
import { InterviewQuestion as InterviewQuestionType } from './interviewFlow'
import { useInterview } from './InterviewContext'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      marginBottom: theme.spacing(3),
      transition: 'all 0.3s ease-in-out'
    },
    card: {
      borderRadius: theme.spacing(2),
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      '&:hover': {
        boxShadow: '0 6px 25px rgba(0,0,0,0.15)'
      }
    },
    cardContent: {
      padding: theme.spacing(4)
    },
    questionHeader: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: theme.spacing(2)
    },
    questionText: {
      fontSize: '1.25rem',
      fontWeight: 500,
      color: theme.palette.text.primary,
      flex: 1,
      marginRight: theme.spacing(1)
    },
    helpButton: {
      padding: theme.spacing(0.5),
      color: theme.palette.primary.main
    },
    helpText: {
      color: theme.palette.text.secondary,
      marginBottom: theme.spacing(3),
      fontSize: '0.95rem',
      lineHeight: 1.6
    },
    formControl: {
      width: '100%',
      marginTop: theme.spacing(2)
    },
    radioGroup: {
      marginTop: theme.spacing(1)
    },
    radioOption: {
      marginBottom: theme.spacing(1),
      padding: theme.spacing(1.5, 2),
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: theme.spacing(1),
      transition: 'all 0.2s ease',
      '&:hover': {
        backgroundColor: theme.palette.action.hover,
        borderColor: theme.palette.primary.main
      }
    },
    radioOptionSelected: {
      backgroundColor: theme.palette.primary.light + '20',
      borderColor: theme.palette.primary.main
    },
    yesNoContainer: {
      display: 'flex',
      gap: theme.spacing(2),
      marginTop: theme.spacing(2)
    },
    yesNoButton: {
      flex: 1,
      padding: theme.spacing(2),
      borderRadius: theme.spacing(1),
      textTransform: 'none',
      fontSize: '1rem',
      fontWeight: 500,
      transition: 'all 0.2s ease'
    },
    yesButton: {
      borderColor: theme.palette.success.main,
      '&:hover': {
        backgroundColor: theme.palette.success.light + '20'
      }
    },
    yesButtonSelected: {
      backgroundColor: theme.palette.success.main,
      color: theme.palette.success.contrastText,
      '&:hover': {
        backgroundColor: theme.palette.success.dark
      }
    },
    noButton: {
      borderColor: theme.palette.grey[400],
      '&:hover': {
        backgroundColor: theme.palette.grey[100]
      }
    },
    noButtonSelected: {
      backgroundColor: theme.palette.grey[700],
      color: theme.palette.common.white,
      '&:hover': {
        backgroundColor: theme.palette.grey[800]
      }
    },
    textField: {
      marginTop: theme.spacing(2),
      '& .MuiOutlinedInput-root': {
        borderRadius: theme.spacing(1)
      }
    },
    whyAskingContainer: {
      marginTop: theme.spacing(3),
      borderTop: `1px solid ${theme.palette.divider}`,
      paddingTop: theme.spacing(2)
    },
    whyAskingButton: {
      textTransform: 'none',
      color: theme.palette.text.secondary,
      fontSize: '0.875rem',
      padding: theme.spacing(0.5, 1),
      '&:hover': {
        backgroundColor: 'transparent',
        color: theme.palette.primary.main
      }
    },
    whyAskingContent: {
      backgroundColor: theme.palette.background.default,
      padding: theme.spacing(2),
      borderRadius: theme.spacing(1),
      marginTop: theme.spacing(1)
    },
    optionHelpText: {
      color: theme.palette.text.secondary,
      fontSize: '0.85rem',
      marginLeft: theme.spacing(4)
    },
    requiredChip: {
      marginLeft: theme.spacing(1),
      height: 20,
      fontSize: '0.7rem'
    },
    errorText: {
      color: theme.palette.error.main,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      marginTop: theme.spacing(1)
    },
    answeredIndicator: {
      display: 'flex',
      alignItems: 'center',
      color: theme.palette.success.main,
      fontSize: '0.875rem',
      marginTop: theme.spacing(1)
    }
  })
)

interface InterviewQuestionProps {
  question: InterviewQuestionType
  showNavigation?: boolean
  onNext?: () => void
  onPrevious?: () => void
  autoAdvance?: boolean
}

export default function InterviewQuestion({
  question,
  autoAdvance = true
}: InterviewQuestionProps): ReactElement {
  const classes = useStyles()
  const [showWhyAsking, setShowWhyAsking] = useState(false)
  const { getAnswer, setAnswer, hasError, getError, nextQuestion } = useInterview()

  const currentAnswer = getAnswer<unknown>(question.id)
  const error = getError(question.id)
  const isAnswered = currentAnswer !== undefined && currentAnswer !== ''

  const handleChange = (value: unknown) => {
    setAnswer(question.id, value)

    // Auto-advance for yes/no and multiple choice (after a brief delay for visual feedback)
    if (autoAdvance && (question.inputType === 'yes_no' || question.inputType === 'multiple_choice')) {
      setTimeout(() => {
        nextQuestion()
      }, 300)
    }
  }

  const handleTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    setAnswer(question.id, event.target.value)
  }

  const handleNumericChange = (value: string) => {
    const numValue = value === '' ? undefined : Number(value)
    setAnswer(question.id, numValue)
  }

  const renderYesNoInput = () => (
    <Box className={classes.yesNoContainer}>
      <Button
        variant={currentAnswer === true ? 'contained' : 'outlined'}
        className={`${classes.yesNoButton} ${classes.yesButton} ${
          currentAnswer === true ? classes.yesButtonSelected : ''
        }`}
        onClick={() => handleChange(true)}
        startIcon={currentAnswer === true ? <CheckCircle /> : undefined}
      >
        Yes
      </Button>
      <Button
        variant={currentAnswer === false ? 'contained' : 'outlined'}
        className={`${classes.yesNoButton} ${classes.noButton} ${
          currentAnswer === false ? classes.noButtonSelected : ''
        }`}
        onClick={() => handleChange(false)}
        startIcon={currentAnswer === false ? <CheckCircle /> : undefined}
      >
        No
      </Button>
    </Box>
  )

  const renderMultipleChoice = () => (
    <FormControl component="fieldset" className={classes.formControl}>
      <FormLabel component="legend" style={{ display: 'none' }}>
        {question.questionText}
      </FormLabel>
      <RadioGroup
        value={currentAnswer ?? ''}
        onChange={(e) => handleChange(e.target.value)}
        className={classes.radioGroup}
      >
        {question.options?.map((option) => (
          <Box key={option.value}>
            <FormControlLabel
              value={option.value}
              control={<Radio color="primary" />}
              label={option.label}
              className={`${classes.radioOption} ${
                currentAnswer === option.value ? classes.radioOptionSelected : ''
              }`}
            />
            {option.helpText && (
              <Typography className={classes.optionHelpText}>
                {option.helpText}
              </Typography>
            )}
          </Box>
        ))}
      </RadioGroup>
    </FormControl>
  )

  const renderNumericInput = () => (
    <NumberFormat
      customInput={TextField}
      className={classes.textField}
      variant="outlined"
      fullWidth
      label="Enter a number"
      value={(currentAnswer as number | string) ?? ''}
      onValueChange={(values) => handleNumericChange(values.value)}
      thousandSeparator={true}
      allowNegative={false}
      decimalScale={0}
      isNumericString={false}
      inputProps={{
        min: question.min,
        max: question.max
      }}
      error={hasError(question.id)}
      helperText={error}
    />
  )

  const renderCurrencyInput = () => (
    <NumberFormat
      customInput={TextField}
      className={classes.textField}
      variant="outlined"
      fullWidth
      label="Enter amount"
      value={(currentAnswer as number | string) ?? ''}
      onValueChange={(values) => handleNumericChange(values.value)}
      thousandSeparator={true}
      allowNegative={false}
      decimalScale={2}
      fixedDecimalScale
      isNumericString={false}
      InputProps={{
        startAdornment: <InputAdornment position="start">$</InputAdornment>
      }}
      inputProps={{
        min: question.min,
        max: question.max
      }}
      error={hasError(question.id)}
      helperText={error}
    />
  )

  const renderTextInput = () => (
    <TextField
      className={classes.textField}
      variant="outlined"
      fullWidth
      label="Your answer"
      value={currentAnswer ?? ''}
      onChange={handleTextChange}
      error={hasError(question.id)}
      helperText={error}
    />
  )

  const renderInput = () => {
    switch (question.inputType) {
      case 'yes_no':
        return renderYesNoInput()
      case 'multiple_choice':
        return renderMultipleChoice()
      case 'numeric':
        return renderNumericInput()
      case 'currency':
        return renderCurrencyInput()
      case 'text':
      case 'date':
      default:
        return renderTextInput()
    }
  }

  return (
    <Fade in={true} timeout={300}>
      <Box className={classes.root}>
        <Card className={classes.card}>
          <CardContent className={classes.cardContent}>
            {/* Question Header */}
            <Box className={classes.questionHeader}>
              <Typography className={classes.questionText}>
                {question.questionText}
                {question.required && (
                  <Chip
                    label="Required"
                    size="small"
                    color="primary"
                    variant="outlined"
                    className={classes.requiredChip}
                  />
                )}
              </Typography>
              {question.helpText && (
                <Tooltip title={question.helpText} arrow placement="left">
                  <IconButton className={classes.helpButton} size="small">
                    <HelpOutline />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            {/* Help Text */}
            {question.helpText && (
              <Typography className={classes.helpText}>
                {question.helpText}
              </Typography>
            )}

            {/* Input */}
            {renderInput()}

            {/* Error Message */}
            {hasError(question.id) && (
              <FormHelperText className={classes.errorText}>
                <ErrorIcon fontSize="small" />
                {error}
              </FormHelperText>
            )}

            {/* Answered Indicator */}
            {isAnswered && !hasError(question.id) && (
              <Box className={classes.answeredIndicator}>
                <CheckCircle fontSize="small" style={{ marginRight: 4 }} />
                Answer saved
              </Box>
            )}

            {/* Why Are We Asking */}
            {question.whyAskingText && (
              <Box className={classes.whyAskingContainer}>
                <Button
                  className={classes.whyAskingButton}
                  onClick={() => setShowWhyAsking(!showWhyAsking)}
                  endIcon={showWhyAsking ? <ExpandLess /> : <ExpandMore />}
                  disableRipple
                >
                  Why are we asking this?
                </Button>
                <Collapse in={showWhyAsking}>
                  <Box className={classes.whyAskingContent}>
                    <Typography variant="body2">
                      {question.whyAskingText}
                    </Typography>
                  </Box>
                </Collapse>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Fade>
  )
}

// Compact version for showing in lists
interface CompactQuestionProps {
  question: InterviewQuestionType
  onClick?: () => void
}

export function CompactQuestion({
  question,
  onClick
}: CompactQuestionProps): ReactElement {
  const { getAnswer, isQuestionSkipped } = useInterview()
  const answer = getAnswer(question.id)
  const isSkipped = isQuestionSkipped(question.id)
  const isAnswered = answer !== undefined && answer !== ''

  const formatAnswer = (): string => {
    if (isSkipped) return 'Skipped'
    if (!isAnswered) return 'Not answered'

    switch (question.inputType) {
      case 'yes_no':
        return answer ? 'Yes' : 'No'
      case 'multiple_choice':
        const option = question.options?.find((o) => o.value === answer)
        return option?.label ?? String(answer)
      case 'currency':
        return `$${Number(answer).toLocaleString()}`
      default:
        return String(answer)
    }
  }

  return (
    <Box
      onClick={onClick}
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid #eee',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      <Typography variant="body2" style={{ flex: 1 }}>
        {question.questionText}
      </Typography>
      <Typography
        variant="body2"
        style={{
          color: isAnswered ? '#4caf50' : isSkipped ? '#ff9800' : '#999',
          fontWeight: isAnswered ? 500 : 400
        }}
      >
        {formatAnswer()}
      </Typography>
    </Box>
  )
}
