/**
 * Interview Context
 * React context for managing wizard state across the interview flow
 */

import {
  createContext,
  useContext,
  useReducer,
  ReactElement,
  PropsWithChildren,
  useCallback,
  useMemo
} from 'react'
import {
  interviewSteps,
  interviewQuestions,
  InterviewStep,
  InterviewQuestion,
  shouldShowQuestion,
  getQuestionById,
  getQuestionsForStep
} from './interviewFlow'

// Interview state
export interface InterviewState {
  currentStepIndex: number
  currentQuestionIndex: number
  answers: Record<string, unknown>
  visitedSteps: Set<string>
  completedSteps: Set<string>
  skippedQuestions: Set<string>
  isComplete: boolean
  errors: Record<string, string>
}

// Action types
type InterviewAction =
  | { type: 'SET_ANSWER'; questionId: string; value: unknown }
  | { type: 'NEXT_QUESTION' }
  | { type: 'PREVIOUS_QUESTION' }
  | { type: 'GO_TO_STEP'; stepIndex: number }
  | { type: 'GO_TO_QUESTION'; stepIndex: number; questionIndex: number }
  | { type: 'COMPLETE_STEP'; stepId: string }
  | { type: 'SKIP_QUESTION'; questionId: string }
  | { type: 'SET_ERROR'; questionId: string; error: string }
  | { type: 'CLEAR_ERROR'; questionId: string }
  | { type: 'RESET' }
  | { type: 'LOAD_STATE'; state: Partial<InterviewState> }

// Initial state
const initialState: InterviewState = {
  currentStepIndex: 0,
  currentQuestionIndex: 0,
  answers: {},
  visitedSteps: new Set([interviewSteps[0]?.id]),
  completedSteps: new Set(),
  skippedQuestions: new Set(),
  isComplete: false,
  errors: {}
}

// Reducer
function interviewReducer(
  state: InterviewState,
  action: InterviewAction
): InterviewState {
  switch (action.type) {
    case 'SET_ANSWER': {
      const newAnswers = { ...state.answers, [action.questionId]: action.value }
      // Clear error when answer is provided
      const newErrors = { ...state.errors }
      delete newErrors[action.questionId]
      return { ...state, answers: newAnswers, errors: newErrors }
    }

    case 'NEXT_QUESTION': {
      const currentStep = interviewSteps[state.currentStepIndex]
      const visibleQuestions = getVisibleQuestionsForStep(currentStep, state.answers)

      if (state.currentQuestionIndex < visibleQuestions.length - 1) {
        // Move to next question in current step
        return {
          ...state,
          currentQuestionIndex: state.currentQuestionIndex + 1
        }
      } else if (state.currentStepIndex < interviewSteps.length - 1) {
        // Move to next step
        const newStepIndex = state.currentStepIndex + 1
        const newStep = interviewSteps[newStepIndex]
        const newVisitedSteps = new Set(state.visitedSteps)
        newVisitedSteps.add(newStep.id)

        const newCompletedSteps = new Set(state.completedSteps)
        newCompletedSteps.add(currentStep.id)

        return {
          ...state,
          currentStepIndex: newStepIndex,
          currentQuestionIndex: 0,
          visitedSteps: newVisitedSteps,
          completedSteps: newCompletedSteps
        }
      } else {
        // Interview complete
        const newCompletedSteps = new Set(state.completedSteps)
        newCompletedSteps.add(currentStep.id)
        return { ...state, isComplete: true, completedSteps: newCompletedSteps }
      }
    }

    case 'PREVIOUS_QUESTION': {
      if (state.currentQuestionIndex > 0) {
        // Move to previous question in current step
        return {
          ...state,
          currentQuestionIndex: state.currentQuestionIndex - 1
        }
      } else if (state.currentStepIndex > 0) {
        // Move to previous step
        const newStepIndex = state.currentStepIndex - 1
        const previousStep = interviewSteps[newStepIndex]
        const visibleQuestions = getVisibleQuestionsForStep(previousStep, state.answers)

        return {
          ...state,
          currentStepIndex: newStepIndex,
          currentQuestionIndex: Math.max(0, visibleQuestions.length - 1)
        }
      }
      return state
    }

    case 'GO_TO_STEP': {
      if (action.stepIndex >= 0 && action.stepIndex < interviewSteps.length) {
        const newStep = interviewSteps[action.stepIndex]
        const newVisitedSteps = new Set(state.visitedSteps)
        newVisitedSteps.add(newStep.id)

        return {
          ...state,
          currentStepIndex: action.stepIndex,
          currentQuestionIndex: 0,
          visitedSteps: newVisitedSteps
        }
      }
      return state
    }

    case 'GO_TO_QUESTION': {
      return {
        ...state,
        currentStepIndex: action.stepIndex,
        currentQuestionIndex: action.questionIndex
      }
    }

    case 'COMPLETE_STEP': {
      const newCompletedSteps = new Set(state.completedSteps)
      newCompletedSteps.add(action.stepId)
      return { ...state, completedSteps: newCompletedSteps }
    }

    case 'SKIP_QUESTION': {
      const newSkippedQuestions = new Set(state.skippedQuestions)
      newSkippedQuestions.add(action.questionId)
      return { ...state, skippedQuestions: newSkippedQuestions }
    }

    case 'SET_ERROR': {
      return {
        ...state,
        errors: { ...state.errors, [action.questionId]: action.error }
      }
    }

    case 'CLEAR_ERROR': {
      const newErrors = { ...state.errors }
      delete newErrors[action.questionId]
      return { ...state, errors: newErrors }
    }

    case 'RESET': {
      return {
        ...initialState,
        visitedSteps: new Set([interviewSteps[0]?.id])
      }
    }

    case 'LOAD_STATE': {
      return {
        ...state,
        ...action.state,
        visitedSteps: new Set(action.state.visitedSteps || state.visitedSteps),
        completedSteps: new Set(action.state.completedSteps || state.completedSteps),
        skippedQuestions: new Set(action.state.skippedQuestions || state.skippedQuestions)
      }
    }

    default:
      return state
  }
}

// Helper to get visible questions for a step
function getVisibleQuestionsForStep(
  step: InterviewStep,
  answers: Record<string, unknown>
): InterviewQuestion[] {
  return getQuestionsForStep(step.id).filter((q) => shouldShowQuestion(q, answers))
}

// Context value type
interface InterviewContextValue {
  state: InterviewState
  currentStep: InterviewStep | null
  currentQuestion: InterviewQuestion | null
  visibleQuestions: InterviewQuestion[]
  totalSteps: number
  progress: number

  // Actions
  setAnswer: (questionId: string, value: unknown) => void
  nextQuestion: () => void
  previousQuestion: () => void
  goToStep: (stepIndex: number) => void
  goToQuestion: (stepIndex: number, questionIndex: number) => void
  completeStep: (stepId: string) => void
  skipQuestion: (questionId: string) => void
  setError: (questionId: string, error: string) => void
  clearError: (questionId: string) => void
  reset: () => void

  // Helpers
  isStepCompleted: (stepId: string) => boolean
  isStepVisited: (stepId: string) => boolean
  isQuestionSkipped: (questionId: string) => boolean
  getAnswer: <T>(questionId: string) => T | undefined
  hasError: (questionId: string) => boolean
  getError: (questionId: string) => string | undefined
  canGoBack: () => boolean
  canGoForward: () => boolean
}

// Create context
const InterviewContext = createContext<InterviewContextValue | null>(null)

// Provider component
export function InterviewProvider({
  children
}: PropsWithChildren<object>): ReactElement {
  const [state, dispatch] = useReducer(interviewReducer, initialState)

  // Memoized current step and question
  const currentStep = useMemo(
    () => interviewSteps[state.currentStepIndex] || null,
    [state.currentStepIndex]
  )

  const visibleQuestions = useMemo(
    () => (currentStep ? getVisibleQuestionsForStep(currentStep, state.answers) : []),
    [currentStep, state.answers]
  )

  const currentQuestion = useMemo(
    () => visibleQuestions[state.currentQuestionIndex] || null,
    [visibleQuestions, state.currentQuestionIndex]
  )

  // Calculate progress
  const progress = useMemo(() => {
    const totalQuestions = interviewQuestions.length
    const answeredQuestions = Object.keys(state.answers).length
    return Math.round((answeredQuestions / totalQuestions) * 100)
  }, [state.answers])

  // Actions
  const setAnswer = useCallback((questionId: string, value: unknown) => {
    dispatch({ type: 'SET_ANSWER', questionId, value })
  }, [])

  const nextQuestion = useCallback(() => {
    dispatch({ type: 'NEXT_QUESTION' })
  }, [])

  const previousQuestion = useCallback(() => {
    dispatch({ type: 'PREVIOUS_QUESTION' })
  }, [])

  const goToStep = useCallback((stepIndex: number) => {
    dispatch({ type: 'GO_TO_STEP', stepIndex })
  }, [])

  const goToQuestion = useCallback((stepIndex: number, questionIndex: number) => {
    dispatch({ type: 'GO_TO_QUESTION', stepIndex, questionIndex })
  }, [])

  const completeStep = useCallback((stepId: string) => {
    dispatch({ type: 'COMPLETE_STEP', stepId })
  }, [])

  const skipQuestion = useCallback((questionId: string) => {
    dispatch({ type: 'SKIP_QUESTION', questionId })
    dispatch({ type: 'NEXT_QUESTION' })
  }, [])

  const setError = useCallback((questionId: string, error: string) => {
    dispatch({ type: 'SET_ERROR', questionId, error })
  }, [])

  const clearError = useCallback((questionId: string) => {
    dispatch({ type: 'CLEAR_ERROR', questionId })
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  // Helpers
  const isStepCompleted = useCallback(
    (stepId: string) => state.completedSteps.has(stepId),
    [state.completedSteps]
  )

  const isStepVisited = useCallback(
    (stepId: string) => state.visitedSteps.has(stepId),
    [state.visitedSteps]
  )

  const isQuestionSkipped = useCallback(
    (questionId: string) => state.skippedQuestions.has(questionId),
    [state.skippedQuestions]
  )

  const getAnswer = useCallback(
    <T,>(questionId: string): T | undefined => state.answers[questionId] as T | undefined,
    [state.answers]
  )

  const hasError = useCallback(
    (questionId: string) => questionId in state.errors,
    [state.errors]
  )

  const getError = useCallback(
    (questionId: string) => state.errors[questionId],
    [state.errors]
  )

  const canGoBack = useCallback(() => {
    return state.currentStepIndex > 0 || state.currentQuestionIndex > 0
  }, [state.currentStepIndex, state.currentQuestionIndex])

  const canGoForward = useCallback(() => {
    return !state.isComplete
  }, [state.isComplete])

  const contextValue: InterviewContextValue = {
    state,
    currentStep,
    currentQuestion,
    visibleQuestions,
    totalSteps: interviewSteps.length,
    progress,
    setAnswer,
    nextQuestion,
    previousQuestion,
    goToStep,
    goToQuestion,
    completeStep,
    skipQuestion,
    setError,
    clearError,
    reset,
    isStepCompleted,
    isStepVisited,
    isQuestionSkipped,
    getAnswer,
    hasError,
    getError,
    canGoBack,
    canGoForward
  }

  return (
    <InterviewContext.Provider value={contextValue}>
      {children}
    </InterviewContext.Provider>
  )
}

// Hook to use interview context
export function useInterview(): InterviewContextValue {
  const context = useContext(InterviewContext)
  if (!context) {
    throw new Error('useInterview must be used within an InterviewProvider')
  }
  return context
}

// Hook to get a specific answer with type safety
export function useInterviewAnswer<T>(questionId: string): T | undefined {
  const { getAnswer } = useInterview()
  return getAnswer<T>(questionId)
}

// Hook to check if a question should be visible
export function useQuestionVisibility(questionId: string): boolean {
  const { state } = useInterview()
  const question = getQuestionById(questionId)
  if (!question) return false
  return shouldShowQuestion(question, state.answers)
}
