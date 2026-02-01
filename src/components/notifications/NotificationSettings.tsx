import { ReactElement, useState, useEffect, useCallback } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  Switch,
  Typography,
  makeStyles
} from '@material-ui/core'
import {
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
  Schedule as ScheduleIcon,
  Email as EmailIcon,
  Warning as WarningIcon
} from '@material-ui/icons'
import {
  NotificationPreferences,
  NotificationType,
  NotificationChannel,
  ReminderTiming,
  updateNotificationPreference,
  toggleNotificationType,
  setReminderTimings,
  setBrowserPermission
} from 'ustaxes/redux/notificationSlice'
import {
  requestNotificationPermission,
  getNotificationPermission,
  isNotificationSupported,
  getNotificationSupportMessage,
  setupNotifications
} from 'ustaxes/core/notifications/notificationService'

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2)
  },
  card: {
    marginBottom: theme.spacing(2)
  },
  section: {
    marginBottom: theme.spacing(3)
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: theme.spacing(1),
    '& svg': {
      marginRight: theme.spacing(1)
    }
  },
  masterToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(2),
    backgroundColor: theme.palette.grey[100],
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2)
  },
  permissionWarning: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(2),
    backgroundColor: theme.palette.warning.light,
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
    '& svg': {
      marginRight: theme.spacing(1),
      color: theme.palette.warning.dark
    }
  },
  permissionDenied: {
    backgroundColor: theme.palette.error.light,
    '& svg': {
      color: theme.palette.error.dark
    }
  },
  enableButton: {
    marginLeft: theme.spacing(2)
  },
  chipContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1)
  },
  timingChip: {
    cursor: 'pointer'
  },
  disabledOverlay: {
    opacity: 0.5,
    pointerEvents: 'none'
  },
  statusChip: {
    marginLeft: theme.spacing(1)
  }
}))

interface NotificationSettingsProps {
  preferences: NotificationPreferences
  browserPermissionStatus: 'default' | 'granted' | 'denied' | 'unsupported'
  onPreferencesChange: (update: Partial<NotificationPreferences>) => void
  onToggleType: (type: NotificationType) => void
  onTimingsChange: (timings: ReminderTiming[]) => void
  onPermissionChange: (
    status: 'default' | 'granted' | 'denied' | 'unsupported'
  ) => void
}

const NotificationSettings = (
  props: NotificationSettingsProps
): ReactElement => {
  const {
    preferences,
    browserPermissionStatus,
    onPreferencesChange,
    onToggleType,
    onTimingsChange,
    onPermissionChange
  } = props

  const classes = useStyles()
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)

  // Check permission on mount
  useEffect(() => {
    const currentPermission = getNotificationPermission()
    onPermissionChange(currentPermission)
  }, [onPermissionChange])

  const handleEnableNotifications = useCallback(async () => {
    if (preferences.channel === NotificationChannel.BROWSER_PUSH) {
      setIsRequestingPermission(true)
      try {
        const permission = await requestNotificationPermission()
        onPermissionChange(permission)
        if (permission === 'granted') {
          onPreferencesChange({ enabled: true })
        }
      } finally {
        setIsRequestingPermission(false)
      }
    } else {
      onPreferencesChange({ enabled: true })
    }
  }, [preferences.channel, onPermissionChange, onPreferencesChange])

  const handleDisableNotifications = useCallback(() => {
    onPreferencesChange({ enabled: false })
  }, [onPreferencesChange])

  const handleChannelChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onPreferencesChange({
        channel: event.target.value as NotificationChannel
      })
    },
    [onPreferencesChange]
  )

  const handleTimingToggle = useCallback(
    (timing: ReminderTiming) => {
      const currentTimings = preferences.reminderTimings
      const newTimings = currentTimings.includes(timing)
        ? currentTimings.filter((t) => t !== timing)
        : [...currentTimings, timing]

      // Ensure at least one timing is selected
      if (newTimings.length > 0) {
        onTimingsChange(newTimings)
      }
    },
    [preferences.reminderTimings, onTimingsChange]
  )

  const isSupported = isNotificationSupported()
  const permissionGranted = browserPermissionStatus === 'granted'
  const permissionDenied = browserPermissionStatus === 'denied'
  const showPermissionPrompt =
    preferences.channel === NotificationChannel.BROWSER_PUSH &&
    browserPermissionStatus === 'default'

  const renderPermissionStatus = (): ReactElement | null => {
    if (preferences.channel !== NotificationChannel.BROWSER_PUSH) {
      return null
    }

    if (!isSupported) {
      return (
        <Box
          className={`${classes.permissionWarning} ${classes.permissionDenied}`}
        >
          <WarningIcon />
          <Typography variant="body2">
            Your browser does not support push notifications. In-app reminders
            will be shown instead.
          </Typography>
        </Box>
      )
    }

    if (permissionDenied) {
      return (
        <Box
          className={`${classes.permissionWarning} ${classes.permissionDenied}`}
        >
          <WarningIcon />
          <Typography variant="body2">
            Push notifications are blocked. Please enable them in your browser
            settings, or switch to in-app reminders.
          </Typography>
        </Box>
      )
    }

    if (showPermissionPrompt && !preferences.enabled) {
      return (
        <Box className={classes.permissionWarning}>
          <WarningIcon />
          <Typography variant="body2">
            {getNotificationSupportMessage()}
          </Typography>
        </Box>
      )
    }

    return null
  }

  const renderMasterToggle = (): ReactElement => {
    return (
      <Box className={classes.masterToggle}>
        <Box display="flex" alignItems="center">
          {preferences.enabled ? (
            <NotificationsIcon color="primary" />
          ) : (
            <NotificationsOffIcon color="disabled" />
          )}
          <Box ml={2}>
            <Typography variant="subtitle1">
              Tax Deadline Notifications
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {preferences.enabled
                ? 'You will receive reminders for upcoming tax deadlines'
                : 'Notifications are currently disabled'}
            </Typography>
          </Box>
        </Box>
        <Switch
          checked={preferences.enabled}
          onChange={
            preferences.enabled
              ? handleDisableNotifications
              : handleEnableNotifications
          }
          color="primary"
          disabled={isRequestingPermission}
        />
      </Box>
    )
  }

  const renderNotificationTypes = (): ReactElement => {
    const types = [
      {
        type: NotificationType.ESTIMATED_TAX,
        label: 'Estimated Tax Payments',
        description: 'Quarterly estimated tax payment reminders'
      },
      {
        type: NotificationType.FILING_DEADLINE,
        label: 'Filing Deadlines',
        description: 'Federal and state tax return due dates'
      },
      {
        type: NotificationType.DOCUMENT_REMINDER,
        label: 'Document Reminders',
        description: 'Reminders to gather W-2s, 1099s, and other tax documents'
      }
    ]

    return (
      <Box className={classes.section}>
        <Typography variant="subtitle2" className={classes.sectionTitle}>
          <ScheduleIcon />
          Notification Types
        </Typography>
        <FormGroup>
          {types.map(({ type, label, description }) => (
            <FormControlLabel
              key={type}
              control={
                <Checkbox
                  checked={preferences.types[type]}
                  onChange={() => onToggleType(type)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body1">{label}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    {description}
                  </Typography>
                </Box>
              }
            />
          ))}
        </FormGroup>
      </Box>
    )
  }

  const renderChannelSelection = (): ReactElement => {
    return (
      <Box className={classes.section}>
        <Typography variant="subtitle2" className={classes.sectionTitle}>
          <NotificationsIcon />
          Notification Method
        </Typography>
        <FormControl component="fieldset">
          <RadioGroup
            value={preferences.channel}
            onChange={handleChannelChange}
          >
            <FormControlLabel
              value={NotificationChannel.BROWSER_PUSH}
              control={<Radio color="primary" />}
              label={
                <Box display="flex" alignItems="center">
                  <Typography>Browser Push Notifications</Typography>
                  {permissionGranted && (
                    <Chip
                      label="Enabled"
                      size="small"
                      color="primary"
                      className={classes.statusChip}
                    />
                  )}
                  {permissionDenied && (
                    <Chip
                      label="Blocked"
                      size="small"
                      color="secondary"
                      className={classes.statusChip}
                    />
                  )}
                </Box>
              }
            />
            <FormControlLabel
              value={NotificationChannel.EMAIL}
              control={<Radio color="primary" />}
              label={
                <Box display="flex" alignItems="center">
                  <EmailIcon style={{ marginRight: 8 }} />
                  <Typography>Email Reminders</Typography>
                  <Chip
                    label="Coming Soon"
                    size="small"
                    variant="outlined"
                    className={classes.statusChip}
                  />
                </Box>
              }
              disabled
            />
          </RadioGroup>
        </FormControl>
      </Box>
    )
  }

  const renderReminderTimings = (): ReactElement => {
    const timingOptions = [
      { value: ReminderTiming.ONE_WEEK_BEFORE, label: '1 week before' },
      { value: ReminderTiming.THREE_DAYS_BEFORE, label: '3 days before' },
      { value: ReminderTiming.DAY_OF, label: 'Day of deadline' }
    ]

    return (
      <Box className={classes.section}>
        <Typography variant="subtitle2" className={classes.sectionTitle}>
          <ScheduleIcon />
          Reminder Timing
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          When would you like to be reminded about upcoming deadlines?
        </Typography>
        <Box className={classes.chipContainer}>
          {timingOptions.map(({ value, label }) => (
            <Chip
              key={value}
              label={label}
              color={
                preferences.reminderTimings.includes(value)
                  ? 'primary'
                  : 'default'
              }
              onClick={() => handleTimingToggle(value)}
              className={classes.timingChip}
              variant={
                preferences.reminderTimings.includes(value)
                  ? 'default'
                  : 'outlined'
              }
            />
          ))}
        </Box>
      </Box>
    )
  }

  return (
    <Box className={classes.root}>
      <Typography variant="h5" gutterBottom>
        Notification Settings
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Configure how and when you want to be reminded about important tax
        deadlines.
      </Typography>

      <Card className={classes.card}>
        <CardContent>
          {renderMasterToggle()}
          {renderPermissionStatus()}

          <Box
            className={
              !preferences.enabled ? classes.disabledOverlay : undefined
            }
          >
            <Divider style={{ margin: '16px 0' }} />
            {renderNotificationTypes()}
            <Divider style={{ margin: '16px 0' }} />
            {renderChannelSelection()}
            <Divider style={{ margin: '16px 0' }} />
            {renderReminderTimings()}
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

export default NotificationSettings
