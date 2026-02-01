/* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import {
  ReactElement,
  useState,
  useCallback,
  Fragment,
  Dispatch,
  SetStateAction
} from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import {
  SwipeableDrawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  Divider,
  IconButton,
  Typography,
  Box,
  makeStyles,
  createStyles,
  Theme,
  useTheme,
  useMediaQuery
} from '@material-ui/core'
import {
  ExpandLess,
  ExpandMore,
  Home as HomeIcon,
  Person as PersonIcon,
  AttachMoney as IncomeIcon,
  Receipt as DeductionsIcon,
  AccountBalance as SavingsIcon,
  Assessment as ResultsIcon,
  Settings as SettingsIcon,
  HelpOutline as HelpIcon,
  Close as CloseIcon,
  ChevronRight as ChevronRightIcon,
  Payment as PaymentIcon,
  TrendingUp as PlanningIcon
} from '@material-ui/icons'
import { useTranslation } from 'react-i18next'
import { Section, SectionItem } from './ResponsiveDrawer'
import { LanguageSelector } from './LanguageSelector'
import { SaveIndicator } from './SaveIndicator'
import Urls from 'ustaxes/data/urls'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    drawer: {
      '& .MuiDrawer-paper': {
        width: '100%',
        maxWidth: 320,
        backgroundColor: theme.palette.background.paper
      }
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.spacing(2),
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText
    },
    headerTitle: {
      fontWeight: 600
    },
    closeButton: {
      color: theme.palette.primary.contrastText
    },
    list: {
      paddingTop: 0,
      paddingBottom: theme.spacing(10) // Space for bottom nav
    },
    sectionHeader: {
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(1.5, 2),
      backgroundColor: theme.palette.grey[100],
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: theme.palette.grey[200]
      }
    },
    sectionIcon: {
      marginRight: theme.spacing(1.5),
      color: theme.palette.primary.main
    },
    sectionTitle: {
      flex: 1,
      fontWeight: 500
    },
    listItem: {
      minHeight: 48, // 44px minimum touch target + padding
      paddingLeft: theme.spacing(4),
      '&.active': {
        backgroundColor: theme.palette.action.selected,
        borderLeft: `3px solid ${theme.palette.primary.main}`
      }
    },
    listItemText: {
      '& .MuiTypography-root': {
        fontSize: '0.95rem'
      }
    },
    nestedList: {
      backgroundColor: theme.palette.background.default
    },
    divider: {
      margin: theme.spacing(1, 0)
    },
    footer: {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      maxWidth: 320,
      padding: theme.spacing(1, 2),
      backgroundColor: theme.palette.background.paper,
      borderTop: `1px solid ${theme.palette.divider}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    footerActions: {
      display: 'flex',
      gap: theme.spacing(1)
    },
    statusBar: {
      padding: theme.spacing(1, 2),
      backgroundColor: theme.palette.grey[50],
      borderBottom: `1px solid ${theme.palette.divider}`
    }
  })
)

// Map section titles to icons
const sectionIcons: Record<string, ReactElement> = {
  'UsTaxes.org': <HomeIcon />,
  Personal: <PersonIcon />,
  Income: <IncomeIcon />,
  Payments: <PaymentIcon />,
  Deductions: <DeductionsIcon />,
  'Savings Accounts': <SavingsIcon />,
  Planning: <PlanningIcon />,
  Results: <ResultsIcon />
}

interface MobileNavProps {
  sections: Section[]
  isOpen: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
}

export const MobileNav = ({
  sections,
  isOpen,
  setOpen
}: MobileNavProps): ReactElement => {
  const classes = useStyles()
  const theme = useTheme()
  const location = useLocation()
  const { t } = useTranslation()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >(() => {
    // Initially expand the section containing the current page
    const initial: Record<string, boolean> = {}
    sections.forEach((section) => {
      const hasCurrentPage = section.items.some(
        (item) => item.url === location.pathname
      )
      initial[section.title] = hasCurrentPage
    })
    return initial
  })

  const toggleSection = useCallback((title: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [title]: !prev[title]
    }))
  }, [])

  const handleItemClick = useCallback(() => {
    if (isMobile) {
      setOpen(false)
    }
  }, [isMobile, setOpen])

  const handleClose = useCallback(() => {
    setOpen(false)
  }, [setOpen])

  const handleOpen = useCallback(() => {
    setOpen(true)
  }, [setOpen])

  return (
    <SwipeableDrawer
      anchor="left"
      open={isOpen}
      onClose={handleClose}
      onOpen={handleOpen}
      className={classes.drawer}
      disableBackdropTransition={!isMobile}
      disableDiscovery={!isMobile}
      swipeAreaWidth={20}
      hysteresis={0.25}
    >
      {/* Header */}
      <Box className={classes.header}>
        <Typography variant="h6" className={classes.headerTitle}>
          {t('app.name')}
        </Typography>
        <IconButton
          onClick={handleClose}
          className={classes.closeButton}
          aria-label={t('mobile.tapToClose')}
          size="medium"
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Status bar */}
      <Box className={classes.statusBar}>
        <SaveIndicator compact />
      </Box>

      {/* Navigation sections */}
      <List
        className={classes.list}
        component="nav"
        aria-label="main navigation"
      >
        {sections.map((section) => (
          <Fragment key={section.title}>
            {/* Section header */}
            <ListItem
              button
              onClick={() => toggleSection(section.title)}
              className={classes.sectionHeader}
              aria-expanded={expandedSections[section.title]}
            >
              <ListItemIcon className={classes.sectionIcon}>
                {sectionIcons[section.title] || <ChevronRightIcon />}
              </ListItemIcon>
              <Typography className={classes.sectionTitle}>
                {section.title}
              </Typography>
              {expandedSections[section.title] ? (
                <ExpandLess />
              ) : (
                <ExpandMore />
              )}
            </ListItem>

            {/* Section items */}
            <Collapse
              in={expandedSections[section.title]}
              timeout="auto"
              unmountOnExit
            >
              <List
                component="div"
                disablePadding
                className={classes.nestedList}
              >
                {section.items.map((item) => (
                  <ListItem
                    key={item.url}
                    button
                    onClick={handleItemClick}
                    className={classes.listItem}
                    {...({
                      component: NavLink,
                      to: item.url,
                      activeClassName: 'active'
                    } as any)}
                  >
                    <ListItemText
                      primary={item.title}
                      className={classes.listItemText}
                    />
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </Fragment>
        ))}

        <Divider className={classes.divider} />

        {/* Settings and Help */}
        <ListItem
          button
          onClick={handleItemClick}
          className={classes.listItem}
          style={{ paddingLeft: 16 }}
          {...({ component: Link, to: Urls.settings } as any)}
        >
          <ListItemIcon>
            <SettingsIcon />
          </ListItemIcon>
          <ListItemText primary={t('nav.settings')} />
        </ListItem>

        <ListItem
          button
          onClick={handleItemClick}
          className={classes.listItem}
          style={{ paddingLeft: 16 }}
          {...({ component: Link, to: Urls.help } as any)}
        >
          <ListItemIcon>
            <HelpIcon />
          </ListItemIcon>
          <ListItemText primary={t('nav.help')} />
        </ListItem>
      </List>

      {/* Footer with language selector */}
      <Box className={classes.footer}>
        <LanguageSelector compact size="small" />
        <Box className={classes.footerActions}>
          <IconButton
            component="a"
            href="https://github.com/ustaxes/UsTaxes"
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            aria-label="GitHub"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </IconButton>
        </Box>
      </Box>
    </SwipeableDrawer>
  )
}

// Bottom navigation bar for mobile
interface MobileBottomNavProps {
  onMenuClick: () => void
}

export const MobileBottomNav = ({
  onMenuClick
}: MobileBottomNavProps): ReactElement => {
  const location = useLocation()
  const { t } = useTranslation()

  const styles = {
    container: {
      position: 'fixed' as const,
      bottom: 0,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderTop: '1px solid #e0e0e0',
      padding: '8px 0',
      zIndex: 1100,
      boxShadow: '0 -2px 4px rgba(0,0,0,0.1)'
    },
    navItem: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      padding: '8px 16px',
      minWidth: 64,
      textDecoration: 'none',
      color: '#666',
      fontSize: '0.75rem'
    },
    navItemActive: {
      color: '#1976d2'
    },
    icon: {
      fontSize: 24,
      marginBottom: 4
    }
  }

  const isActive = (url: string) => location.pathname === url

  return (
    <nav style={styles.container} className="mobile-bottom-nav">
      <Link
        to={Urls.usTaxes.start}
        style={{
          ...styles.navItem,
          ...(isActive(Urls.usTaxes.start) ? styles.navItemActive : {})
        }}
      >
        <HomeIcon style={styles.icon} />
        <span>{t('mobile.home')}</span>
      </Link>

      <Link
        to={Urls.income.w2s}
        style={{
          ...styles.navItem,
          ...(location.pathname.includes('/income') ? styles.navItemActive : {})
        }}
      >
        <IncomeIcon style={styles.icon} />
        <span>{t('nav.income')}</span>
      </Link>

      <Link
        to={Urls.createPdf}
        style={{
          ...styles.navItem,
          ...(isActive(Urls.createPdf) ? styles.navItemActive : {})
        }}
      >
        <ResultsIcon style={styles.icon} />
        <span>{t('nav.results')}</span>
      </Link>

      <button
        onClick={onMenuClick}
        style={{
          ...styles.navItem,
          border: 'none',
          background: 'none',
          cursor: 'pointer'
        }}
      >
        <SettingsIcon style={styles.icon} />
        <span>{t('mobile.more')}</span>
      </button>
    </nav>
  )
}

export default MobileNav
