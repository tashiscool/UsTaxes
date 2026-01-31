import { ReactElement, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { useSelector } from 'react-redux'
import {
  createStyles,
  makeStyles,
  AppBar,
  Box,
  IconButton,
  Slide,
  Theme,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'
import MenuIcon from '@material-ui/icons/Menu'
import PrintIcon from '@material-ui/icons/Print'
import ResponsiveDrawer, {
  item,
  Section,
  SectionItem
} from './ResponsiveDrawer'

import W2JobInfo from './income/W2JobInfo'
import CreatePDF from './CreatePDF'
import PrimaryTaxpayer from './TaxPayer'
import RefundBankAccount from './RefundBankAccount'
import SpouseAndDependent from './TaxPayer/SpouseAndDependent'
import F1099Info from './income/F1099Info'
import EstimatedTaxes from './payments/EstimatedTaxes'
import RealEstate from './income/RealEstate'
import GettingStarted from './GettingStarted'
import F1098eInfo from './deductions/F1098eInfo'
import ItemizedDeductions from './deductions/ItemizedDeductions'
import Questions from './Questions'
import HelpAndFeedback from './HelpAndFeedback'
import UserSettings from './UserSettings'
import Urls from 'ustaxes/data/urls'

import { isMobileOnly as isMobileDevice } from 'react-device-detect'
import HealthSavingsAccounts from './savingsAccounts/healthSavingsAccounts'
import IRA from './savingsAccounts/IRA'
import OtherInvestments from './income/OtherInvestments'
import { StockOptions } from './income/StockOptions'
import { PartnershipIncome } from './income/PartnershipIncome'
import OBBBAIncome from './income/OBBBAIncome'
import BrokerageImport from './import/BrokerageImport'
import CryptoImport from './import/CryptoImport'
import PayrollImport from './import/PayrollImport'
import { InterviewWizard } from './interview'
import { TaxPlanningCalculator } from './planning'
import { WhatIfTool } from './scenarios'
import { TaxYear } from 'ustaxes/core/data'
import { AdvanceChildTaxCredit } from './Y2021/AdvanceChildTaxCredit'
import { YearsTaxesState } from 'ustaxes/redux'

// New UX components
import { MobileNav, MobileBottomNav } from './MobileNav'
import { PrintPreview } from './PrintPreview'
import { SaveIndicator, SyncStatusIcon } from './SaveIndicator'
import { LanguageSelector } from './LanguageSelector'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      flexGrow: 1,
      zIndex: theme.zIndex.drawer + 1,
      [theme.breakpoints.up('sm')]: {
        display: 'none'
      }
    },
    desktopAppBar: {
      display: 'none',
      [theme.breakpoints.up('sm')]: {
        display: 'flex',
        position: 'fixed',
        top: 0,
        left: 240, // drawer width
        right: 0,
        zIndex: theme.zIndex.drawer - 1,
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
        boxShadow: 'none'
      }
    },
    desktopToolbar: {
      minHeight: 48,
      justifyContent: 'flex-end',
      padding: theme.spacing(0, 2)
    },
    toolbar: {
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    title: {
      position: 'absolute',
      width: '100%',
      textAlign: 'center',
      pointerEvents: 'none'
    },
    mobileTitle: {
      flex: 1,
      textAlign: 'center'
    },
    menuButton: {
      marginRight: theme.spacing(1),
      [theme.breakpoints.up('sm')]: {
        display: 'none'
      }
    },
    gutters: {
      margin: '0 12px',
      padding: 0
    },
    toolbarActions: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1)
    },
    desktopActions: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2)
    },
    saveIndicator: {
      display: 'none',
      [theme.breakpoints.up('sm')]: {
        display: 'flex'
      }
    },
    mobileOnly: {
      display: 'flex',
      [theme.breakpoints.up('sm')]: {
        display: 'none'
      }
    },
    desktopOnly: {
      display: 'none',
      [theme.breakpoints.up('sm')]: {
        display: 'flex'
      }
    }
  })
)

const getTitleAndPage = (currentUrl: string, year: TaxYear): string => {
  const backPage = backPages.find(({ url }) => url === currentUrl)
  if (backPage) return backPage.title

  const page = drawerSectionsForYear(year)
    .flatMap(({ title: sectionTitle, items }) =>
      items.map(({ title, url }) => ({ sectionTitle, title, url }))
    )
    .find(({ url }) => url === currentUrl)

  return `${page?.sectionTitle ?? ''} - ${page?.title ?? ''}`
}

export const backPages: SectionItem[] = [
  {
    title: 'User Settings',
    url: Urls.settings,
    element: <UserSettings />
  },
  {
    title: 'Help and Feedback',
    url: Urls.help,
    element: <HelpAndFeedback />
  }
]

export const drawerSections: Section[] = [
  {
    title: 'UsTaxes.org',
    items: [
      item('Getting Started', Urls.usTaxes.start, <GettingStarted />),
      item('Interview Mode', Urls.usTaxes.interview, <InterviewWizard />)
    ]
  },
  {
    title: 'Personal',
    items: [
      item('Primary Taxpayer', Urls.taxPayer.info, <PrimaryTaxpayer />),
      item(
        'Spouse and Dependents',
        Urls.taxPayer.spouseAndDependent,
        <SpouseAndDependent />
      )
    ]
  },
  {
    title: 'Income',
    items: [
      item('Wages (W2)', Urls.income.w2s, <W2JobInfo />),
      item('Income (1099)', Urls.income.f1099s, <F1099Info />),
      item('Rental income', Urls.income.realEstate, <RealEstate />),
      item(
        'Other investments',
        Urls.income.otherInvestments,
        <OtherInvestments />
      ),
      item('Stock options', Urls.income.stockOptions, <StockOptions />),
      item(
        'Partnership Income',
        Urls.income.partnershipIncome,
        <PartnershipIncome />
      ),
      item(
        'Import Brokerage CSV',
        Urls.income.brokerageImport,
        <BrokerageImport />
      ),
      item(
        'Import Crypto',
        Urls.income.cryptoImport,
        <CryptoImport />
      ),
      item(
        'Import W-2 (Payroll)',
        Urls.income.payrollImport,
        <PayrollImport />
      )
    ]
  },
  {
    title: 'Payments',
    items: [
      item('Estimated Taxes', Urls.payments.estimatedTaxes, <EstimatedTaxes />)
    ]
  },
  {
    title: 'Deductions',
    items: [
      item('Student Loan Interest', Urls.deductions.f1098es, <F1098eInfo />),
      item(
        'Itemized Deductions',
        Urls.deductions.itemized,
        <ItemizedDeductions />
      )
    ]
  },
  {
    title: 'Savings Accounts',
    items: [
      item(
        'Health Savings Account (HSA)',
        Urls.savingsAccounts.healthSavingsAccounts,
        <HealthSavingsAccounts />
      ),
      item(
        'Individual Retirement Arrangements (IRA)',
        Urls.savingsAccounts.ira,
        <IRA />
      )
    ]
  },
  {
    title: 'Planning',
    items: [
      item(
        'Tax Planning Calculator',
        Urls.planning.calculator,
        <TaxPlanningCalculator />
      ),
      item(
        'What-If Scenarios',
        Urls.tools.whatIf,
        <WhatIfTool />
      )
    ]
  },
  {
    title: 'Results',
    items: [
      item('Refund Information', Urls.refund, <RefundBankAccount />),
      item('Informational Questions', Urls.questions, <Questions />),
      item('Review and Print', Urls.createPdf, <CreatePDF />)
    ]
  }
]

const yearSpecificPages: Partial<{ [k in TaxYear]: Section[] }> = {
  Y2021: [
    {
      title: 'Tax Year 2021',
      items: [
        item(
          'Advance Child Tax Credit (Letter 6419)',
          Urls.Y2021.credits,
          <AdvanceChildTaxCredit />
        )
      ]
    }
  ],
  Y2025: [
    {
      title: 'OBBBA 2025 Provisions',
      items: [
        item('OBBBA Deductions', Urls.income.obbba, <OBBBAIncome />)
      ]
    }
  ]
}

export const drawerSectionsForYear = (year: TaxYear): Section[] => [
  ...drawerSections.slice(0, -1),
  ...(yearSpecificPages[year] || []),
  drawerSections[drawerSections.length - 1]
]

const Menu = (): ReactElement => {
  const classes = useStyles()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('xs')) || isMobileDevice
  const [isOpen, setOpen] = useState(!isMobile)
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false)
  const location = useLocation()

  const activeYear: TaxYear = useSelector(
    (state: YearsTaxesState) => state.activeYear
  )

  const allSections = drawerSectionsForYear(activeYear)
  const currentPageTitle = getTitleAndPage(location.pathname, activeYear)

  const handlePrintPreviewOpen = () => {
    setPrintPreviewOpen(true)
  }

  const handlePrintPreviewClose = () => {
    setPrintPreviewOpen(false)
  }

  return (
    <>
      {/* Mobile App Bar */}
      <AppBar position="fixed" className={classes.root}>
        <Toolbar
          className={classes.toolbar}
          classes={{ gutters: classes.gutters }}
        >
          <IconButton
            color="inherit"
            aria-label={`${isOpen ? 'close' : 'open'} drawer`}
            edge="start"
            onClick={() => setOpen((isOpen) => !isOpen)}
            className={classes.menuButton}
          >
            {isOpen ? <CloseIcon /> : <MenuIcon />}
          </IconButton>

          <Slide in={isOpen} direction={'right'}>
            <Typography className={classes.title}>Menu</Typography>
          </Slide>
          <Slide in={!isOpen} direction={'left'}>
            <Typography className={classes.title}>
              {currentPageTitle}
            </Typography>
          </Slide>

          {/* Mobile toolbar actions */}
          <Box className={classes.mobileOnly}>
            <SyncStatusIcon size="small" />
          </Box>
        </Toolbar>
      </AppBar>

      {/* Desktop secondary toolbar */}
      <AppBar position="fixed" className={classes.desktopAppBar} color="default">
        <Toolbar className={classes.desktopToolbar}>
          <Box className={classes.desktopActions}>
            <SaveIndicator showTimestamp />

            <IconButton
              size="small"
              onClick={handlePrintPreviewOpen}
              aria-label="Print Preview"
              title="Print Preview"
            >
              <PrintIcon />
            </IconButton>

            <LanguageSelector compact size="small" />
          </Box>
        </Toolbar>
      </AppBar>

      {/* Use MobileNav for mobile devices, ResponsiveDrawer for desktop */}
      {isMobile ? (
        <MobileNav
          sections={allSections}
          isOpen={isOpen}
          setOpen={setOpen}
        />
      ) : (
        <ResponsiveDrawer
          sections={allSections}
          isOpen={isOpen}
          setOpen={setOpen}
        />
      )}

      {/* Mobile bottom navigation */}
      {isMobile && (
        <MobileBottomNav onMenuClick={() => setOpen(true)} />
      )}

      {/* Print Preview Modal */}
      <PrintPreview
        open={printPreviewOpen}
        onClose={handlePrintPreviewClose}
        title="Tax Return Preview"
      />
    </>
  )
}

export default Menu
