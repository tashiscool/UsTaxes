import { ReactElement, useMemo } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Tooltip,
  Typography,
  makeStyles
} from '@material-ui/core'
import {
  Event as EventIcon,
  Payment as PaymentIcon,
  Description as DescriptionIcon,
  ChevronRight as ChevronRightIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon
} from '@material-ui/icons'
import { Link } from 'react-router-dom'
import { State } from 'ustaxes/core/data'
import {
  DeadlineType,
  DeadlineWithStatus,
  getAllDeadlinesForYear,
  getUpcomingDeadlines,
  getDaysRemainingText,
  formatDeadlineDate
} from 'ustaxes/core/notifications/deadlineTracker'
import { EstimatedTaxPaymentRecord } from 'ustaxes/redux/notificationSlice'

const useStyles = makeStyles((theme) => ({
  root: {
    height: '100%'
  },
  header: {
    paddingBottom: 0
  },
  headerAction: {
    marginTop: 0,
    marginRight: 0
  },
  list: {
    padding: 0
  },
  listItem: {
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    '&:hover': {
      backgroundColor: theme.palette.action.hover
    }
  },
  listItemUrgent: {
    backgroundColor: theme.palette.error.light,
    '&:hover': {
      backgroundColor: theme.palette.error.light
    }
  },
  listItemWarning: {
    backgroundColor: theme.palette.warning.light,
    '&:hover': {
      backgroundColor: theme.palette.warning.light
    }
  },
  iconUrgent: {
    color: theme.palette.error.main
  },
  iconWarning: {
    color: theme.palette.warning.main
  },
  iconNormal: {
    color: theme.palette.primary.main
  },
  iconPast: {
    color: theme.palette.text.disabled
  },
  iconPaid: {
    color: theme.palette.success.main
  },
  daysChip: {
    minWidth: 80
  },
  daysChipUrgent: {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText
  },
  daysChipWarning: {
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText
  },
  daysChipNormal: {
    backgroundColor: theme.palette.grey[200]
  },
  daysChipPast: {
    backgroundColor: theme.palette.error.dark,
    color: theme.palette.error.contrastText
  },
  daysChipPaid: {
    backgroundColor: theme.palette.success.main,
    color: theme.palette.success.contrastText
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
    color: theme.palette.text.secondary
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: theme.spacing(2),
    color: theme.palette.success.main
  },
  viewAllButton: {
    marginTop: theme.spacing(1)
  },
  footer: {
    padding: theme.spacing(2),
    textAlign: 'center',
    borderTop: `1px solid ${theme.palette.divider}`
  },
  secondaryText: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5)
  }
}))

interface UpcomingDeadlinesProps {
  taxYear?: number
  states?: State[]
  estimatedTaxPayments?: EstimatedTaxPaymentRecord[]
  maxVisible?: number
  showPastDeadlines?: boolean
  onRefresh?: () => void
  onDeadlineClick?: (deadline: DeadlineWithStatus) => void
}

const UpcomingDeadlines = (props: UpcomingDeadlinesProps): ReactElement => {
  const {
    taxYear = 2025,
    states = [],
    estimatedTaxPayments = [],
    maxVisible = 5,
    showPastDeadlines = false,
    onRefresh,
    onDeadlineClick
  } = props

  const classes = useStyles()
  const now = new Date()

  // Get deadlines and add payment status
  const deadlines = useMemo(() => {
    const allDeadlines = showPastDeadlines
      ? getAllDeadlinesForYear(taxYear, states, true, now)
      : getUpcomingDeadlines(taxYear, states, now)

    // Add payment info to estimated tax deadlines
    return allDeadlines.map((deadline) => {
      if (
        deadline.type === DeadlineType.ESTIMATED_TAX_Q1 ||
        deadline.type === DeadlineType.ESTIMATED_TAX_Q2 ||
        deadline.type === DeadlineType.ESTIMATED_TAX_Q3 ||
        deadline.type === DeadlineType.ESTIMATED_TAX_Q4
      ) {
        const quarter = getQuarterFromDeadlineType(deadline.type)
        const payment = estimatedTaxPayments.find(
          (p) => p.quarter === quarter && p.year === taxYear
        )
        return {
          ...deadline,
          isPaid: payment !== undefined && payment.amount > 0,
          paidAmount: payment?.amount
        }
      }
      return { ...deadline, isPaid: false, paidAmount: undefined }
    })
  }, [taxYear, states, estimatedTaxPayments, showPastDeadlines, now])

  const visibleDeadlines = deadlines.slice(0, maxVisible)
  const hasMoreDeadlines = deadlines.length > maxVisible

  const getQuarterFromDeadlineType = (type: DeadlineType): 1 | 2 | 3 | 4 | null => {
    switch (type) {
      case DeadlineType.ESTIMATED_TAX_Q1:
        return 1
      case DeadlineType.ESTIMATED_TAX_Q2:
        return 2
      case DeadlineType.ESTIMATED_TAX_Q3:
        return 3
      case DeadlineType.ESTIMATED_TAX_Q4:
        return 4
      default:
        return null
    }
  }

  const getDeadlineIcon = (
    deadline: DeadlineWithStatus & { isPaid?: boolean }
  ): ReactElement => {
    const isEstimatedTax =
      deadline.type === DeadlineType.ESTIMATED_TAX_Q1 ||
      deadline.type === DeadlineType.ESTIMATED_TAX_Q2 ||
      deadline.type === DeadlineType.ESTIMATED_TAX_Q3 ||
      deadline.type === DeadlineType.ESTIMATED_TAX_Q4

    // Paid estimated tax
    if (deadline.isPaid) {
      return <CheckCircleIcon className={classes.iconPaid} />
    }

    // Past due (not paid)
    if (deadline.isPast) {
      return <WarningIcon className={classes.iconUrgent} />
    }

    // Urgent
    if (deadline.isUrgent || deadline.isToday) {
      if (isEstimatedTax) {
        return <PaymentIcon className={classes.iconUrgent} />
      }
      return <DescriptionIcon className={classes.iconUrgent} />
    }

    // Warning (within 30 days)
    if (deadline.isUpcoming) {
      if (isEstimatedTax) {
        return <PaymentIcon className={classes.iconWarning} />
      }
      return <DescriptionIcon className={classes.iconWarning} />
    }

    // Normal
    if (isEstimatedTax) {
      return <PaymentIcon className={classes.iconNormal} />
    }
    return <EventIcon className={classes.iconNormal} />
  }

  const getDaysChipClass = (
    deadline: DeadlineWithStatus & { isPaid?: boolean }
  ): string => {
    if (deadline.isPaid) {
      return `${classes.daysChip} ${classes.daysChipPaid}`
    }
    if (deadline.isPast) {
      return `${classes.daysChip} ${classes.daysChipPast}`
    }
    if (deadline.isToday || deadline.isUrgent) {
      return `${classes.daysChip} ${classes.daysChipUrgent}`
    }
    if (deadline.isUpcoming) {
      return `${classes.daysChip} ${classes.daysChipWarning}`
    }
    return `${classes.daysChip} ${classes.daysChipNormal}`
  }

  const getListItemClass = (
    deadline: DeadlineWithStatus & { isPaid?: boolean }
  ): string => {
    if (deadline.isPaid || deadline.isPast) {
      return classes.listItem
    }
    if (deadline.isToday || deadline.isUrgent) {
      return `${classes.listItem} ${classes.listItemUrgent}`
    }
    if (deadline.isUpcoming) {
      return `${classes.listItem} ${classes.listItemWarning}`
    }
    return classes.listItem
  }

  const getDaysLabel = (
    deadline: DeadlineWithStatus & { isPaid?: boolean }
  ): string => {
    if (deadline.isPaid) {
      return 'Paid'
    }
    return getDaysRemainingText(deadline.daysRemaining)
  }

  const getActionUrl = (deadline: DeadlineWithStatus): string => {
    if (
      deadline.type === DeadlineType.ESTIMATED_TAX_Q1 ||
      deadline.type === DeadlineType.ESTIMATED_TAX_Q2 ||
      deadline.type === DeadlineType.ESTIMATED_TAX_Q3 ||
      deadline.type === DeadlineType.ESTIMATED_TAX_Q4
    ) {
      return '/payments/estimated-taxes'
    }
    if (deadline.type === DeadlineType.FEDERAL_FILING) {
      return '/summary'
    }
    if (deadline.type === DeadlineType.STATE_FILING) {
      return '/summary'
    }
    return '/info'
  }

  const renderDeadlineItem = (
    deadline: DeadlineWithStatus & { isPaid?: boolean; paidAmount?: number }
  ): ReactElement => {
    const formattedDate = formatDeadlineDate(deadline.date)

    return (
      <ListItem
        key={deadline.id}
        className={getListItemClass(deadline)}
        button
        component={Link}
        to={getActionUrl(deadline)}
        onClick={() => onDeadlineClick?.(deadline)}
      >
        <ListItemIcon>{getDeadlineIcon(deadline)}</ListItemIcon>
        <ListItemText
          primary={deadline.title}
          secondary={
            <span className={classes.secondaryText}>
              <ScheduleIcon style={{ fontSize: 14 }} />
              {formattedDate}
              {deadline.paidAmount !== undefined && (
                <span> - Paid: ${deadline.paidAmount.toLocaleString()}</span>
              )}
            </span>
          }
        />
        <ListItemSecondaryAction>
          <Box display="flex" alignItems="center">
            <Chip
              label={getDaysLabel(deadline)}
              size="small"
              className={getDaysChipClass(deadline)}
            />
            <IconButton
              edge="end"
              size="small"
              component={Link}
              to={getActionUrl(deadline)}
            >
              <ChevronRightIcon />
            </IconButton>
          </Box>
        </ListItemSecondaryAction>
      </ListItem>
    )
  }

  const renderEmptyState = (): ReactElement => {
    return (
      <Box className={classes.emptyState}>
        <CheckCircleIcon className={classes.emptyIcon} />
        <Typography variant="h6" gutterBottom>
          All caught up!
        </Typography>
        <Typography variant="body2">
          No upcoming tax deadlines at the moment.
        </Typography>
      </Box>
    )
  }

  return (
    <Card className={classes.root}>
      <CardHeader
        title="Upcoming Deadlines"
        titleTypographyProps={{ variant: 'h6' }}
        action={
          onRefresh && (
            <Tooltip title="Refresh">
              <IconButton onClick={onRefresh} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )
        }
        classes={{
          root: classes.header,
          action: classes.headerAction
        }}
      />
      <Divider />
      <CardContent style={{ padding: 0 }}>
        {visibleDeadlines.length === 0 ? (
          renderEmptyState()
        ) : (
          <List className={classes.list}>
            {visibleDeadlines.map((deadline) => renderDeadlineItem(deadline))}
          </List>
        )}
      </CardContent>
      {hasMoreDeadlines && (
        <Box className={classes.footer}>
          <Button
            component={Link}
            to="/settings/notifications"
            size="small"
            color="primary"
          >
            View All {deadlines.length} Deadlines
          </Button>
        </Box>
      )}
    </Card>
  )
}

export default UpcomingDeadlines
