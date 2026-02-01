import { ReactElement, useState, useCallback } from 'react'
import {
  Box,
  Button,
  Collapse,
  IconButton,
  Paper,
  Typography,
  makeStyles
} from '@material-ui/core'
import {
  Close as CloseIcon,
  Warning as WarningIcon,
  Event as EventIcon,
  ChevronRight as ChevronRightIcon,
  AccessTime as AccessTimeIcon
} from '@material-ui/icons'
import { Link } from 'react-router-dom'
import {
  ScheduledReminder,
  NotificationType
} from 'ustaxes/redux/notificationSlice'
import {
  DeadlineWithStatus,
  getDaysRemainingText
} from 'ustaxes/core/notifications/deadlineTracker'

const useStyles = makeStyles((theme) => ({
  root: {
    marginBottom: theme.spacing(2)
  },
  banner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius
  },
  bannerUrgent: {
    backgroundColor: theme.palette.error.light,
    border: `1px solid ${theme.palette.error.main}`
  },
  bannerWarning: {
    backgroundColor: theme.palette.warning.light,
    border: `1px solid ${theme.palette.warning.main}`
  },
  bannerInfo: {
    backgroundColor: theme.palette.info.light,
    border: `1px solid ${theme.palette.info.main}`
  },
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    marginRight: theme.spacing(2)
  },
  iconUrgent: {
    color: theme.palette.error.dark
  },
  iconWarning: {
    color: theme.palette.warning.dark
  },
  iconInfo: {
    color: theme.palette.info.dark
  },
  content: {
    flex: 1
  },
  title: {
    fontWeight: 600
  },
  titleUrgent: {
    color: theme.palette.error.dark
  },
  titleWarning: {
    color: theme.palette.warning.dark
  },
  titleInfo: {
    color: theme.palette.info.dark
  },
  description: {
    marginTop: theme.spacing(0.5)
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: theme.spacing(2)
  },
  actionButton: {
    marginRight: theme.spacing(1)
  },
  closeButton: {
    marginLeft: theme.spacing(1)
  },
  daysRemaining: {
    display: 'flex',
    alignItems: 'center',
    marginTop: theme.spacing(0.5),
    '& svg': {
      fontSize: '1rem',
      marginRight: theme.spacing(0.5)
    }
  }
}))

type BannerVariant = 'urgent' | 'warning' | 'info'

interface NotificationBannerProps {
  deadline?: DeadlineWithStatus
  reminder?: ScheduledReminder
  title?: string
  message?: string
  actionText?: string
  actionUrl?: string
  variant?: BannerVariant
  onDismiss?: () => void
  onAction?: () => void
}

const NotificationBanner = (
  props: NotificationBannerProps
): ReactElement | null => {
  const {
    deadline,
    reminder,
    title: propTitle,
    message: propMessage,
    actionText = 'View Details',
    actionUrl,
    variant: propVariant,
    onDismiss,
    onAction
  } = props

  const classes = useStyles()
  const [dismissed, setDismissed] = useState(false)

  // Determine content based on props
  const title = propTitle ?? deadline?.title ?? reminder?.title ?? ''
  const message =
    propMessage ?? deadline?.description ?? reminder?.message ?? ''

  // Determine variant based on urgency
  const getVariant = (): BannerVariant => {
    if (propVariant) return propVariant

    if (deadline) {
      if (deadline.isToday || deadline.isPast) return 'urgent'
      if (deadline.isUrgent) return 'warning'
      return 'info'
    }

    if (reminder) {
      const reminderDate = new Date(reminder.reminderDate)
      const now = new Date()
      const daysUntil = Math.ceil(
        (reminderDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysUntil <= 0) return 'urgent'
      if (daysUntil <= 3) return 'warning'
      return 'info'
    }

    return 'info'
  }

  const variant = getVariant()

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    if (onDismiss) {
      onDismiss()
    }
  }, [onDismiss])

  const handleAction = useCallback(() => {
    if (onAction) {
      onAction()
    }
  }, [onAction])

  const getBannerClass = (): string => {
    switch (variant) {
      case 'urgent':
        return `${classes.banner} ${classes.bannerUrgent}`
      case 'warning':
        return `${classes.banner} ${classes.bannerWarning}`
      default:
        return `${classes.banner} ${classes.bannerInfo}`
    }
  }

  const getIconClass = (): string => {
    switch (variant) {
      case 'urgent':
        return classes.iconUrgent
      case 'warning':
        return classes.iconWarning
      default:
        return classes.iconInfo
    }
  }

  const getTitleClass = (): string => {
    switch (variant) {
      case 'urgent':
        return `${classes.title} ${classes.titleUrgent}`
      case 'warning':
        return `${classes.title} ${classes.titleWarning}`
      default:
        return `${classes.title} ${classes.titleInfo}`
    }
  }

  const renderIcon = (): ReactElement => {
    const iconClass = getIconClass()
    if (variant === 'urgent') {
      return <WarningIcon className={iconClass} />
    }
    return <EventIcon className={iconClass} />
  }

  const renderDaysRemaining = (): ReactElement | null => {
    if (!deadline) return null

    const text = getDaysRemainingText(deadline.daysRemaining)

    return (
      <Typography variant="caption" className={classes.daysRemaining}>
        <AccessTimeIcon />
        {text}
      </Typography>
    )
  }

  const renderActionButton = (): ReactElement => {
    if (actionUrl) {
      return (
        <Button
          component={Link}
          to={actionUrl}
          size="small"
          variant="outlined"
          className={classes.actionButton}
          onClick={handleAction}
          endIcon={<ChevronRightIcon />}
        >
          {actionText}
        </Button>
      )
    }

    return (
      <Button
        size="small"
        variant="outlined"
        className={classes.actionButton}
        onClick={handleAction}
        endIcon={<ChevronRightIcon />}
      >
        {actionText}
      </Button>
    )
  }

  if (!title || dismissed) {
    return null
  }

  return (
    <Collapse in={!dismissed} className={classes.root}>
      <Paper elevation={0} className={getBannerClass()}>
        <Box className={classes.iconContainer}>{renderIcon()}</Box>

        <Box className={classes.content}>
          <Typography variant="subtitle1" className={getTitleClass()}>
            {title}
          </Typography>
          <Typography variant="body2" className={classes.description}>
            {message}
          </Typography>
          {renderDaysRemaining()}
        </Box>

        <Box className={classes.actions}>
          {renderActionButton()}
          {onDismiss && (
            <IconButton
              size="small"
              onClick={handleDismiss}
              className={classes.closeButton}
              aria-label="Dismiss notification"
            >
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </Paper>
    </Collapse>
  )
}

/**
 * Helper component for multiple banners
 */
interface NotificationBannerListProps {
  deadlines?: DeadlineWithStatus[]
  reminders?: ScheduledReminder[]
  maxVisible?: number
  onDismiss?: (id: string) => void
}

export const NotificationBannerList = (
  props: NotificationBannerListProps
): ReactElement => {
  const { deadlines = [], reminders = [], maxVisible = 3, onDismiss } = props

  // Combine and sort by urgency
  const items: Array<{
    type: 'deadline' | 'reminder'
    data: DeadlineWithStatus | ScheduledReminder
  }> = [
    ...deadlines.map((d) => ({ type: 'deadline' as const, data: d })),
    ...reminders
      .filter((r) => !r.dismissed && !r.acknowledged)
      .map((r) => ({ type: 'reminder' as const, data: r }))
  ]

  // Sort by urgency (past due first, then by days remaining)
  items.sort((a, b) => {
    const getUrgency = (item: (typeof items)[0]): number => {
      if (item.type === 'deadline') {
        const d = item.data as DeadlineWithStatus
        if (d.isPast) return -1000
        if (d.isToday) return 0
        return d.daysRemaining
      } else {
        const r = item.data as ScheduledReminder
        const reminderDate = new Date(r.reminderDate)
        const now = new Date()
        return Math.ceil(
          (reminderDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
      }
    }
    return getUrgency(a) - getUrgency(b)
  })

  const visibleItems = items.slice(0, maxVisible)

  return (
    <Box>
      {visibleItems.map((item, index) => {
        if (item.type === 'deadline') {
          const deadline = item.data as DeadlineWithStatus
          return (
            <NotificationBanner
              key={deadline.id}
              deadline={deadline}
              actionUrl="/payments/estimated-taxes"
              onDismiss={onDismiss ? () => onDismiss(deadline.id) : undefined}
            />
          )
        } else {
          const reminder = item.data as ScheduledReminder
          return (
            <NotificationBanner
              key={reminder.id}
              reminder={reminder}
              actionUrl="/payments/estimated-taxes"
              onDismiss={onDismiss ? () => onDismiss(reminder.id) : undefined}
            />
          )
        }
      })}
    </Box>
  )
}

export default NotificationBanner
