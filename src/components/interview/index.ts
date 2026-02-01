/**
 * Interview Wizard Module
 * Exports all interview-related components and utilities
 */

export {
  default as InterviewWizard,
  InterviewWizardEntry
} from './InterviewWizard'
export {
  default as InterviewQuestion,
  CompactQuestion
} from './InterviewQuestion'
export {
  InterviewProvider,
  useInterview,
  useInterviewAnswer,
  useQuestionVisibility
} from './InterviewContext'
export type { InterviewState } from './InterviewContext'
export {
  interviewQuestions,
  interviewSteps,
  interviewCategories,
  getQuestionById,
  getStepById,
  getCategoryById,
  getQuestionsForStep,
  shouldShowQuestion,
  getNextQuestionId
} from './interviewFlow'
export type {
  InterviewQuestion as InterviewQuestionType,
  InterviewStep,
  InterviewCategory,
  QuestionCategory,
  QuestionInputType,
  QuestionOption,
  BranchCondition
} from './interviewFlow'
