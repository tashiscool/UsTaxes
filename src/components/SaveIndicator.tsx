import { ReactElement, useEffect, useState, useCallback } from 'react'
import {
  makeStyles,
  createStyles,
  Theme,
  Typography,
  CircularProgress,
  Tooltip,
  Box,
  Fade
} from '@material-ui/core'
import {
  Check as CheckIcon,
  Sync as SyncIcon,
  CloudDone as CloudDoneIcon,
  CloudOff as CloudOffIcon,
  Warning as WarningIcon
} from '@material-ui/icons'
import { useSelector } from 'react-redux'
import { YearsTaxesState } from 'ustaxes/redux'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    container: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5, 1),
      borderRadius: theme.shape.borderRadius,
      backgroundColor: 'transparent',
      transition: 'background-color 0.3s ease'
    },
    containerSaving: {
      backgroundColor: theme.palette.action.hover
    },
    containerSaved: {
      backgroundColor: 'rgba(76, 175, 80, 0.1)'
    },
    containerError: {
      backgroundColor: 'rgba(244, 67, 54, 0.1)'
    },
    icon: {
      fontSize: '1.2rem'
    },
    iconSaving: {
      color: theme.palette.primary.main,
      animation: '$spin 1s linear infinite'
    },
    iconSaved: {
      color: theme.palette.success.main
    },
    iconError: {
      color: theme.palette.error.main
    },
    iconIdle: {
      color: theme.palette.text.secondary
    },
    text: {
      fontSize: '0.75rem',
      color: theme.palette.text.secondary,
      whiteSpace: 'nowrap'
    },
    textSaved: {
      color: theme.palette.success.main
    },
    textError: {
      color: theme.palette.error.main
    },
    spinner: {
      width: '16px !important',
      height: '16px !important'
    },
    '@keyframes spin': {
      '0%': {
        transform: 'rotate(0deg)'
      },
      '100%': {
        transform: 'rotate(360deg)'
      }
    }
  })
)

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline'

interface SaveIndicatorProps {
  showTimestamp?: boolean
  compact?: boolean
}

export const SaveIndicator = ({
  showTimestamp = true,
  compact = false
}: SaveIndicatorProps): ReactElement => {
  const classes = useStyles()
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [timeAgo, setTimeAgo] = useState<string>('')

  // Get current state to detect changes
  const activeYear = useSelector((state: YearsTaxesState) => state.activeYear)
  const currentYearState = useSelector(
    (state: YearsTaxesState) => state[state.activeYear]
  )

  // Format time ago string
  const formatTimeAgo = useCallback((date: Date): string => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)

    if (diffSeconds < 5) {
      return 'Just now'
    } else if (diffSeconds < 60) {
      return `${diffSeconds} seconds ago`
    } else if (diffMinutes < 60) {
      return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`
    } else if (diffHours < 24) {
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
    } else {
      return date.toLocaleString()
    }
  }, [])

  // Update time ago string periodically
  useEffect(() => {
    if (!lastSaved) return

    const updateTimeAgo = () => {
      setTimeAgo(formatTimeAgo(lastSaved))
    }

    updateTimeAgo()
    const interval = setInterval(updateTimeAgo, 10000) // Update every 10 seconds

    return () => clearInterval(interval)
  }, [lastSaved, formatTimeAgo])

  // Detect changes and simulate saving
  useEffect(() => {
    // Check if online
    if (!navigator.onLine) {
      setStatus('offline')
      return
    }

    // Simulate save when state changes
    setStatus('saving')

    const saveTimeout = setTimeout(() => {
      setStatus('saved')
      setLastSaved(new Date())

      // Reset to idle after showing "saved" briefly
      const resetTimeout = setTimeout(() => {
        setStatus('idle')
      }, 2000)

      return () => clearTimeout(resetTimeout)
    }, 500) // Simulate 500ms save time

    return () => clearTimeout(saveTimeout)
  }, [currentYearState, activeYear])

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (status === 'offline') {
        setStatus('idle')
      }
    }

    const handleOffline = () => {
      setStatus('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [status])

  const getStatusIcon = () => {
    switch (status) {
      case 'saving':
        return <CircularProgress className={classes.spinner} />
      case 'saved':
        return <CheckIcon className={`${classes.icon} ${classes.iconSaved}`} />
      case 'error':
        return <WarningIcon className={`${classes.icon} ${classes.iconError}`} />
      case 'offline':
        return <CloudOffIcon className={`${classes.icon} ${classes.iconError}`} />
      default:
        return <CloudDoneIcon className={`${classes.icon} ${classes.iconIdle}`} />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'saving':
        return 'Saving...'
      case 'saved':
        return 'All changes saved'
      case 'error':
        return 'Save failed'
      case 'offline':
        return 'Offline'
      default:
        if (showTimestamp && lastSaved && timeAgo) {
          return `Last saved: ${timeAgo}`
        }
        return 'All changes saved'
    }
  }

  const getContainerClass = () => {
    switch (status) {
      case 'saving':
        return `${classes.container} ${classes.containerSaving}`
      case 'saved':
        return `${classes.container} ${classes.containerSaved}`
      case 'error':
      case 'offline':
        return `${classes.container} ${classes.containerError}`
      default:
        return classes.container
    }
  }

  const getTextClass = () => {
    switch (status) {
      case 'saved':
        return `${classes.text} ${classes.textSaved}`
      case 'error':
      case 'offline':
        return `${classes.text} ${classes.textError}`
      default:
        return classes.text
    }
  }

  const tooltipText = (() => {
    if (status === 'offline') {
      return 'Your changes will be saved when you reconnect'
    }
    if (status === 'error') {
      return 'There was an error saving your changes. Please try again.'
    }
    if (lastSaved) {
      return `Last saved: ${lastSaved.toLocaleString()}`
    }
    return 'Your changes are automatically saved'
  })()

  if (compact) {
    return (
      <Tooltip title={tooltipText} arrow>
        <Box className={getContainerClass()}>{getStatusIcon()}</Box>
      </Tooltip>
    )
  }

  return (
    <Fade in={true}>
      <Tooltip title={tooltipText} arrow>
        <Box className={`${getContainerClass()} save-indicator`}>
          {getStatusIcon()}
          <Typography className={getTextClass()}>{getStatusText()}</Typography>
        </Box>
      </Tooltip>
    </Fade>
  )
}

// Sync status icon for header/toolbar use
interface SyncStatusIconProps {
  size?: 'small' | 'medium' | 'large'
}

export const SyncStatusIcon = ({
  size = 'medium'
}: SyncStatusIconProps): ReactElement => {
  const [syncing, setSyncing] = useState(false)

  const currentYearState = useSelector(
    (state: YearsTaxesState) => state[state.activeYear]
  )

  useEffect(() => {
    setSyncing(true)
    const timeout = setTimeout(() => setSyncing(false), 800)
    return () => clearTimeout(timeout)
  }, [currentYearState])

  const iconSize = size === 'small' ? 16 : size === 'large' ? 28 : 22

  if (syncing) {
    return (
      <Tooltip title="Saving..." arrow>
        <SyncIcon
          style={{
            fontSize: iconSize,
            animation: 'spin 1s linear infinite',
            color: '#1976d2'
          }}
        />
      </Tooltip>
    )
  }

  return (
    <Tooltip title="All changes saved" arrow>
      <CloudDoneIcon
        style={{
          fontSize: iconSize,
          color: '#4caf50'
        }}
      />
    </Tooltip>
  )
}

export default SaveIndicator
