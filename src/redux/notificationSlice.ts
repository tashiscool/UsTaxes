import { TaxYear } from 'ustaxes/core/data'

// ============================================================================
// Types
// ============================================================================

export enum NotificationType {
  ESTIMATED_TAX = 'ESTIMATED_TAX',
  FILING_DEADLINE = 'FILING_DEADLINE',
  DOCUMENT_REMINDER = 'DOCUMENT_REMINDER'
}

export enum ReminderTiming {
  ONE_WEEK_BEFORE = 7,
  THREE_DAYS_BEFORE = 3,
  DAY_OF = 0
}

export enum NotificationChannel {
  BROWSER_PUSH = 'BROWSER_PUSH',
  EMAIL = 'EMAIL'
}

export interface NotificationPreferences {
  enabled: boolean
  channel: NotificationChannel
  types: {
    [NotificationType.ESTIMATED_TAX]: boolean
    [NotificationType.FILING_DEADLINE]: boolean
    [NotificationType.DOCUMENT_REMINDER]: boolean
  }
  reminderTimings: ReminderTiming[]
}

export interface ScheduledReminder {
  id: string
  type: NotificationType
  title: string
  message: string
  deadlineDate: string // ISO date string
  reminderDate: string // ISO date string
  dismissed: boolean
  acknowledged: boolean
}

export interface DismissedNotification {
  id: string
  dismissedAt: string // ISO date string
}

export interface EstimatedTaxPaymentRecord {
  quarter: 1 | 2 | 3 | 4
  year: number
  amount: number
  paidDate?: string
}

export interface NotificationState {
  preferences: NotificationPreferences
  scheduledReminders: ScheduledReminder[]
  dismissedNotifications: DismissedNotification[]
  estimatedTaxPayments: EstimatedTaxPaymentRecord[]
  browserPermissionStatus: 'default' | 'granted' | 'denied' | 'unsupported'
}

// ============================================================================
// Initial State
// ============================================================================

export const defaultNotificationPreferences: NotificationPreferences = {
  enabled: false,
  channel: NotificationChannel.BROWSER_PUSH,
  types: {
    [NotificationType.ESTIMATED_TAX]: true,
    [NotificationType.FILING_DEADLINE]: true,
    [NotificationType.DOCUMENT_REMINDER]: true
  },
  reminderTimings: [ReminderTiming.ONE_WEEK_BEFORE, ReminderTiming.DAY_OF]
}

export const initialNotificationState: NotificationState = {
  preferences: defaultNotificationPreferences,
  scheduledReminders: [],
  dismissedNotifications: [],
  estimatedTaxPayments: [],
  browserPermissionStatus: 'default'
}

// ============================================================================
// Action Names
// ============================================================================

export enum NotificationActionName {
  SET_PREFERENCES = 'NOTIFICATIONS/SET_PREFERENCES',
  UPDATE_PREFERENCE = 'NOTIFICATIONS/UPDATE_PREFERENCE',
  TOGGLE_NOTIFICATION_TYPE = 'NOTIFICATIONS/TOGGLE_TYPE',
  SET_REMINDER_TIMINGS = 'NOTIFICATIONS/SET_REMINDER_TIMINGS',
  ADD_SCHEDULED_REMINDER = 'NOTIFICATIONS/ADD_SCHEDULED_REMINDER',
  REMOVE_SCHEDULED_REMINDER = 'NOTIFICATIONS/REMOVE_SCHEDULED_REMINDER',
  DISMISS_NOTIFICATION = 'NOTIFICATIONS/DISMISS_NOTIFICATION',
  ACKNOWLEDGE_REMINDER = 'NOTIFICATIONS/ACKNOWLEDGE_REMINDER',
  CLEAR_DISMISSED = 'NOTIFICATIONS/CLEAR_DISMISSED',
  SET_BROWSER_PERMISSION = 'NOTIFICATIONS/SET_BROWSER_PERMISSION',
  ADD_ESTIMATED_TAX_PAYMENT = 'NOTIFICATIONS/ADD_ESTIMATED_TAX_PAYMENT',
  REMOVE_ESTIMATED_TAX_PAYMENT = 'NOTIFICATIONS/REMOVE_ESTIMATED_TAX_PAYMENT',
  UPDATE_ESTIMATED_TAX_PAYMENT = 'NOTIFICATIONS/UPDATE_ESTIMATED_TAX_PAYMENT'
}

// ============================================================================
// Action Types
// ============================================================================

interface SetPreferencesAction {
  type: typeof NotificationActionName.SET_PREFERENCES
  payload: NotificationPreferences
}

interface UpdatePreferenceAction {
  type: typeof NotificationActionName.UPDATE_PREFERENCE
  payload: Partial<NotificationPreferences>
}

interface ToggleNotificationTypeAction {
  type: typeof NotificationActionName.TOGGLE_NOTIFICATION_TYPE
  payload: NotificationType
}

interface SetReminderTimingsAction {
  type: typeof NotificationActionName.SET_REMINDER_TIMINGS
  payload: ReminderTiming[]
}

interface AddScheduledReminderAction {
  type: typeof NotificationActionName.ADD_SCHEDULED_REMINDER
  payload: ScheduledReminder
}

interface RemoveScheduledReminderAction {
  type: typeof NotificationActionName.REMOVE_SCHEDULED_REMINDER
  payload: string // reminder id
}

interface DismissNotificationAction {
  type: typeof NotificationActionName.DISMISS_NOTIFICATION
  payload: string // notification id
}

interface AcknowledgeReminderAction {
  type: typeof NotificationActionName.ACKNOWLEDGE_REMINDER
  payload: string // reminder id
}

interface ClearDismissedAction {
  type: typeof NotificationActionName.CLEAR_DISMISSED
}

interface SetBrowserPermissionAction {
  type: typeof NotificationActionName.SET_BROWSER_PERMISSION
  payload: NotificationState['browserPermissionStatus']
}

interface AddEstimatedTaxPaymentAction {
  type: typeof NotificationActionName.ADD_ESTIMATED_TAX_PAYMENT
  payload: EstimatedTaxPaymentRecord
}

interface RemoveEstimatedTaxPaymentAction {
  type: typeof NotificationActionName.REMOVE_ESTIMATED_TAX_PAYMENT
  payload: { quarter: 1 | 2 | 3 | 4; year: number }
}

interface UpdateEstimatedTaxPaymentAction {
  type: typeof NotificationActionName.UPDATE_ESTIMATED_TAX_PAYMENT
  payload: EstimatedTaxPaymentRecord
}

export type NotificationActions =
  | SetPreferencesAction
  | UpdatePreferenceAction
  | ToggleNotificationTypeAction
  | SetReminderTimingsAction
  | AddScheduledReminderAction
  | RemoveScheduledReminderAction
  | DismissNotificationAction
  | AcknowledgeReminderAction
  | ClearDismissedAction
  | SetBrowserPermissionAction
  | AddEstimatedTaxPaymentAction
  | RemoveEstimatedTaxPaymentAction
  | UpdateEstimatedTaxPaymentAction

// ============================================================================
// Reducer
// ============================================================================

export const notificationReducer = (
  state: NotificationState = initialNotificationState,
  action: NotificationActions
): NotificationState => {
  switch (action.type) {
    case NotificationActionName.SET_PREFERENCES:
      return {
        ...state,
        preferences: action.payload
      }

    case NotificationActionName.UPDATE_PREFERENCE:
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.payload
        }
      }

    case NotificationActionName.TOGGLE_NOTIFICATION_TYPE:
      return {
        ...state,
        preferences: {
          ...state.preferences,
          types: {
            ...state.preferences.types,
            [action.payload]: !state.preferences.types[action.payload]
          }
        }
      }

    case NotificationActionName.SET_REMINDER_TIMINGS:
      return {
        ...state,
        preferences: {
          ...state.preferences,
          reminderTimings: action.payload
        }
      }

    case NotificationActionName.ADD_SCHEDULED_REMINDER:
      return {
        ...state,
        scheduledReminders: [...state.scheduledReminders, action.payload]
      }

    case NotificationActionName.REMOVE_SCHEDULED_REMINDER:
      return {
        ...state,
        scheduledReminders: state.scheduledReminders.filter(
          (r) => r.id !== action.payload
        )
      }

    case NotificationActionName.DISMISS_NOTIFICATION:
      return {
        ...state,
        dismissedNotifications: [
          ...state.dismissedNotifications,
          {
            id: action.payload,
            dismissedAt: new Date().toISOString()
          }
        ],
        scheduledReminders: state.scheduledReminders.map((r) =>
          r.id === action.payload ? { ...r, dismissed: true } : r
        )
      }

    case NotificationActionName.ACKNOWLEDGE_REMINDER:
      return {
        ...state,
        scheduledReminders: state.scheduledReminders.map((r) =>
          r.id === action.payload ? { ...r, acknowledged: true } : r
        )
      }

    case NotificationActionName.CLEAR_DISMISSED:
      return {
        ...state,
        dismissedNotifications: []
      }

    case NotificationActionName.SET_BROWSER_PERMISSION:
      return {
        ...state,
        browserPermissionStatus: action.payload
      }

    case NotificationActionName.ADD_ESTIMATED_TAX_PAYMENT:
      return {
        ...state,
        estimatedTaxPayments: [...state.estimatedTaxPayments, action.payload]
      }

    case NotificationActionName.REMOVE_ESTIMATED_TAX_PAYMENT:
      return {
        ...state,
        estimatedTaxPayments: state.estimatedTaxPayments.filter(
          (p) =>
            !(p.quarter === action.payload.quarter && p.year === action.payload.year)
        )
      }

    case NotificationActionName.UPDATE_ESTIMATED_TAX_PAYMENT:
      return {
        ...state,
        estimatedTaxPayments: state.estimatedTaxPayments.map((p) =>
          p.quarter === action.payload.quarter && p.year === action.payload.year
            ? action.payload
            : p
        )
      }

    default:
      return state
  }
}

// ============================================================================
// Action Creators
// ============================================================================

export const setNotificationPreferences = (
  preferences: NotificationPreferences
): SetPreferencesAction => ({
  type: NotificationActionName.SET_PREFERENCES,
  payload: preferences
})

export const updateNotificationPreference = (
  update: Partial<NotificationPreferences>
): UpdatePreferenceAction => ({
  type: NotificationActionName.UPDATE_PREFERENCE,
  payload: update
})

export const toggleNotificationType = (
  notificationType: NotificationType
): ToggleNotificationTypeAction => ({
  type: NotificationActionName.TOGGLE_NOTIFICATION_TYPE,
  payload: notificationType
})

export const setReminderTimings = (
  timings: ReminderTiming[]
): SetReminderTimingsAction => ({
  type: NotificationActionName.SET_REMINDER_TIMINGS,
  payload: timings
})

export const addScheduledReminder = (
  reminder: ScheduledReminder
): AddScheduledReminderAction => ({
  type: NotificationActionName.ADD_SCHEDULED_REMINDER,
  payload: reminder
})

export const removeScheduledReminder = (
  reminderId: string
): RemoveScheduledReminderAction => ({
  type: NotificationActionName.REMOVE_SCHEDULED_REMINDER,
  payload: reminderId
})

export const dismissNotification = (
  notificationId: string
): DismissNotificationAction => ({
  type: NotificationActionName.DISMISS_NOTIFICATION,
  payload: notificationId
})

export const acknowledgeReminder = (
  reminderId: string
): AcknowledgeReminderAction => ({
  type: NotificationActionName.ACKNOWLEDGE_REMINDER,
  payload: reminderId
})

export const clearDismissedNotifications = (): ClearDismissedAction => ({
  type: NotificationActionName.CLEAR_DISMISSED
})

export const setBrowserPermission = (
  status: NotificationState['browserPermissionStatus']
): SetBrowserPermissionAction => ({
  type: NotificationActionName.SET_BROWSER_PERMISSION,
  payload: status
})

export const addEstimatedTaxPayment = (
  payment: EstimatedTaxPaymentRecord
): AddEstimatedTaxPaymentAction => ({
  type: NotificationActionName.ADD_ESTIMATED_TAX_PAYMENT,
  payload: payment
})

export const removeEstimatedTaxPayment = (
  quarter: 1 | 2 | 3 | 4,
  year: number
): RemoveEstimatedTaxPaymentAction => ({
  type: NotificationActionName.REMOVE_ESTIMATED_TAX_PAYMENT,
  payload: { quarter, year }
})

export const updateEstimatedTaxPayment = (
  payment: EstimatedTaxPaymentRecord
): UpdateEstimatedTaxPaymentAction => ({
  type: NotificationActionName.UPDATE_ESTIMATED_TAX_PAYMENT,
  payload: payment
})

// ============================================================================
// Selectors
// ============================================================================

export const selectNotificationPreferences = (state: {
  notifications: NotificationState
}): NotificationPreferences => state.notifications.preferences

export const selectScheduledReminders = (state: {
  notifications: NotificationState
}): ScheduledReminder[] => state.notifications.scheduledReminders

export const selectActiveReminders = (state: {
  notifications: NotificationState
}): ScheduledReminder[] =>
  state.notifications.scheduledReminders.filter(
    (r) => !r.dismissed && !r.acknowledged
  )

export const selectDismissedNotifications = (state: {
  notifications: NotificationState
}): DismissedNotification[] => state.notifications.dismissedNotifications

export const selectBrowserPermissionStatus = (state: {
  notifications: NotificationState
}): NotificationState['browserPermissionStatus'] =>
  state.notifications.browserPermissionStatus

export const selectEstimatedTaxPayments = (state: {
  notifications: NotificationState
}): EstimatedTaxPaymentRecord[] => state.notifications.estimatedTaxPayments

export const selectEstimatedTaxPaymentByQuarter = (
  state: { notifications: NotificationState },
  quarter: 1 | 2 | 3 | 4,
  year: number
): EstimatedTaxPaymentRecord | undefined =>
  state.notifications.estimatedTaxPayments.find(
    (p) => p.quarter === quarter && p.year === year
  )
