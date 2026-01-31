import {
  NotificationType,
  ReminderTiming,
  ScheduledReminder,
  NotificationPreferences
} from 'ustaxes/redux/notificationSlice'
import {
  Deadline,
  DeadlineWithStatus,
  ESTIMATED_TAX_DATES_2025,
  formatDeadlineDate,
  getDaysRemainingText,
  daysBetween
} from './deadlineTracker'

// ============================================================================
// Types
// ============================================================================

export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  tag?: string
  data?: Record<string, unknown>
  requireInteraction?: boolean
}

export interface ScheduleOptions {
  deadlineDate: Date
  reminderTimings: ReminderTiming[]
  notificationType: NotificationType
  title: string
  message: string
}

export type BrowserPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported'

// ============================================================================
// Browser Push API Support Detection
// ============================================================================

/**
 * Check if the browser supports the Notification API
 */
export const isNotificationSupported = (): boolean => {
  return 'Notification' in window
}

/**
 * Check if the browser supports Service Workers (needed for push notifications)
 */
export const isServiceWorkerSupported = (): boolean => {
  return 'serviceWorker' in navigator
}

/**
 * Check if push notifications are fully supported
 */
export const isPushNotificationSupported = (): boolean => {
  return isNotificationSupported() && isServiceWorkerSupported()
}

/**
 * Get the current notification permission status
 */
export const getNotificationPermission = (): BrowserPermissionStatus => {
  if (!isNotificationSupported()) {
    return 'unsupported'
  }
  return Notification.permission as BrowserPermissionStatus
}

// ============================================================================
// Permission Handling
// ============================================================================

/**
 * Request notification permission from the user
 * Returns the resulting permission status
 */
export const requestNotificationPermission =
  async (): Promise<BrowserPermissionStatus> => {
    if (!isNotificationSupported()) {
      console.warn('Notifications are not supported in this browser')
      return 'unsupported'
    }

    try {
      const permission = await Notification.requestPermission()
      return permission as BrowserPermissionStatus
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return 'denied'
    }
  }

/**
 * Check if we have permission to show notifications
 */
export const hasNotificationPermission = (): boolean => {
  return getNotificationPermission() === 'granted'
}

// ============================================================================
// Notification Display
// ============================================================================

/**
 * Show a browser notification
 * Returns the Notification instance or null if failed
 */
export const showNotification = (
  payload: NotificationPayload
): Notification | null => {
  if (!hasNotificationPermission()) {
    console.warn('Notification permission not granted')
    return null
  }

  try {
    const notification = new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon ?? '/favicon.ico',
      tag: payload.tag,
      data: payload.data,
      requireInteraction: payload.requireInteraction ?? false
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }

    return notification
  } catch (error) {
    console.error('Error showing notification:', error)
    return null
  }
}

/**
 * Show an estimated tax reminder notification
 */
export const showEstimatedTaxNotification = (
  quarter: 1 | 2 | 3 | 4,
  daysRemaining: number,
  amount?: number
): Notification | null => {
  const quarterNames = ['Q1', 'Q2', 'Q3', 'Q4']
  const quarterName = quarterNames[quarter - 1]

  let body = `Your ${quarterName} estimated tax payment is due `
  if (daysRemaining === 0) {
    body += 'today!'
  } else if (daysRemaining === 1) {
    body += 'tomorrow.'
  } else {
    body += `in ${daysRemaining} days.`
  }

  if (amount !== undefined && amount > 0) {
    body += ` Suggested payment: $${amount.toLocaleString()}`
  }

  return showNotification({
    title: `${quarterName} Estimated Tax Due`,
    body,
    tag: `estimated-tax-${quarter}`,
    requireInteraction: daysRemaining <= 1
  })
}

/**
 * Show a filing deadline notification
 */
export const showFilingDeadlineNotification = (
  daysRemaining: number,
  isExtension: boolean = false
): Notification | null => {
  const title = isExtension
    ? 'Extension Filing Deadline'
    : 'Tax Filing Deadline'

  let body = `Your tax return is due `
  if (daysRemaining === 0) {
    body += 'today!'
  } else if (daysRemaining === 1) {
    body += 'tomorrow.'
  } else {
    body += `in ${daysRemaining} days.`
  }

  return showNotification({
    title,
    body,
    tag: isExtension ? 'extension-deadline' : 'filing-deadline',
    requireInteraction: daysRemaining <= 1
  })
}

// ============================================================================
// Notification Scheduling
// ============================================================================

// Store for scheduled timeouts (in-memory, will be lost on page refresh)
const scheduledNotifications: Map<string, NodeJS.Timeout> = new Map()

/**
 * Generate a unique ID for a scheduled reminder
 */
export const generateReminderId = (
  notificationType: NotificationType,
  deadlineDate: Date,
  reminderTiming: ReminderTiming
): string => {
  const dateStr = deadlineDate.toISOString().split('T')[0]
  return `${notificationType}-${dateStr}-${reminderTiming}`
}

/**
 * Calculate the reminder date based on deadline and timing
 */
export const calculateReminderDate = (
  deadlineDate: Date,
  timing: ReminderTiming
): Date => {
  const reminderDate = new Date(deadlineDate)
  reminderDate.setDate(reminderDate.getDate() - timing)
  return reminderDate
}

/**
 * Schedule a notification to be shown at a specific time
 * Note: This uses setTimeout which only works while the page is open.
 * For persistent reminders, you would need a Service Worker with Push API.
 */
export const scheduleNotification = (
  id: string,
  payload: NotificationPayload,
  scheduledTime: Date
): boolean => {
  const now = new Date()
  const delay = scheduledTime.getTime() - now.getTime()

  if (delay <= 0) {
    // Time has passed, show immediately
    showNotification(payload)
    return true
  }

  // Cancel any existing scheduled notification with the same ID
  cancelScheduledNotification(id)

  // Schedule the notification
  const timeout = setTimeout(() => {
    showNotification(payload)
    scheduledNotifications.delete(id)
  }, delay)

  scheduledNotifications.set(id, timeout)
  return true
}

/**
 * Cancel a scheduled notification
 */
export const cancelScheduledNotification = (id: string): boolean => {
  const timeout = scheduledNotifications.get(id)
  if (timeout) {
    clearTimeout(timeout)
    scheduledNotifications.delete(id)
    return true
  }
  return false
}

/**
 * Cancel all scheduled notifications
 */
export const cancelAllScheduledNotifications = (): void => {
  scheduledNotifications.forEach((timeout, id) => {
    clearTimeout(timeout)
  })
  scheduledNotifications.clear()
}

/**
 * Create scheduled reminders for a deadline based on preferences
 */
export const createScheduledReminders = (
  deadline: Deadline,
  notificationType: NotificationType,
  reminderTimings: ReminderTiming[]
): ScheduledReminder[] => {
  return reminderTimings.map((timing) => {
    const reminderDate = calculateReminderDate(deadline.date, timing)
    const daysRemaining = timing

    let message = `${deadline.title} is `
    if (timing === ReminderTiming.DAY_OF) {
      message += 'due today!'
    } else if (timing === ReminderTiming.THREE_DAYS_BEFORE) {
      message += 'due in 3 days.'
    } else {
      message += 'due in 1 week.'
    }

    return {
      id: generateReminderId(notificationType, deadline.date, timing),
      type: notificationType,
      title: deadline.title,
      message,
      deadlineDate: deadline.date.toISOString(),
      reminderDate: reminderDate.toISOString(),
      dismissed: false,
      acknowledged: false
    }
  })
}

/**
 * Schedule all reminders for the 2025 estimated tax deadlines
 */
export const scheduleEstimatedTaxReminders2025 = (
  preferences: NotificationPreferences,
  onReminderCreated?: (reminder: ScheduledReminder) => void
): ScheduledReminder[] => {
  if (!preferences.enabled || !preferences.types[NotificationType.ESTIMATED_TAX]) {
    return []
  }

  const deadlines = [
    {
      id: 'estimated-q1-2025',
      title: 'Q1 2025 Estimated Tax Payment',
      date: ESTIMATED_TAX_DATES_2025.Q1
    },
    {
      id: 'estimated-q2-2025',
      title: 'Q2 2025 Estimated Tax Payment',
      date: ESTIMATED_TAX_DATES_2025.Q2
    },
    {
      id: 'estimated-q3-2025',
      title: 'Q3 2025 Estimated Tax Payment',
      date: ESTIMATED_TAX_DATES_2025.Q3
    },
    {
      id: 'estimated-q4-2025',
      title: 'Q4 2025 Estimated Tax Payment',
      date: ESTIMATED_TAX_DATES_2025.Q4
    }
  ]

  const allReminders: ScheduledReminder[] = []

  deadlines.forEach((deadline) => {
    const reminders = createScheduledReminders(
      deadline as Deadline,
      NotificationType.ESTIMATED_TAX,
      preferences.reminderTimings
    )

    reminders.forEach((reminder) => {
      const reminderDate = new Date(reminder.reminderDate)
      if (reminderDate > new Date()) {
        // Only schedule future reminders
        scheduleNotification(
          reminder.id,
          {
            title: reminder.title,
            body: reminder.message,
            tag: reminder.id
          },
          reminderDate
        )
      }

      if (onReminderCreated) {
        onReminderCreated(reminder)
      }
      allReminders.push(reminder)
    })
  })

  return allReminders
}

// ============================================================================
// Fallback for Unsupported Browsers
// ============================================================================

/**
 * Check if we should use the fallback UI instead of native notifications
 */
export const shouldUseFallback = (): boolean => {
  return !isPushNotificationSupported() || getNotificationPermission() === 'denied'
}

/**
 * Get a user-friendly message about notification support
 */
export const getNotificationSupportMessage = (): string => {
  if (!isNotificationSupported()) {
    return 'Your browser does not support notifications. You will see in-app reminders instead.'
  }

  const permission = getNotificationPermission()
  switch (permission) {
    case 'granted':
      return 'Notifications are enabled.'
    case 'denied':
      return 'Notifications are blocked. You can enable them in your browser settings, or use in-app reminders.'
    case 'default':
      return 'Click "Enable" to receive browser notifications for tax deadlines.'
    default:
      return 'Notifications are not available. You will see in-app reminders instead.'
  }
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the notification service
 * Checks for support and existing permission
 */
export const initializeNotificationService = async (): Promise<{
  supported: boolean
  permission: BrowserPermissionStatus
}> => {
  const supported = isPushNotificationSupported()
  const permission = getNotificationPermission()

  return { supported, permission }
}

/**
 * Set up notifications based on user preferences
 * Call this when preferences change or on app initialization
 */
export const setupNotifications = async (
  preferences: NotificationPreferences,
  onReminderCreated?: (reminder: ScheduledReminder) => void
): Promise<{
  success: boolean
  reminders: ScheduledReminder[]
  message: string
}> => {
  if (!preferences.enabled) {
    cancelAllScheduledNotifications()
    return {
      success: true,
      reminders: [],
      message: 'Notifications disabled'
    }
  }

  // Request permission if not already granted
  if (
    preferences.channel === 'BROWSER_PUSH' &&
    getNotificationPermission() === 'default'
  ) {
    const permission = await requestNotificationPermission()
    if (permission !== 'granted') {
      return {
        success: false,
        reminders: [],
        message: 'Notification permission was not granted'
      }
    }
  }

  // Schedule reminders for 2025 estimated taxes
  const reminders = scheduleEstimatedTaxReminders2025(preferences, onReminderCreated)

  return {
    success: true,
    reminders,
    message: `Scheduled ${reminders.length} reminders`
  }
}
