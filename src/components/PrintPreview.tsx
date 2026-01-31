import { ReactElement, useState, useRef } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  Box,
  Divider,
  Paper,
  makeStyles,
  createStyles,
  Theme
} from '@material-ui/core'
import {
  Print as PrintIcon,
  Close as CloseIcon,
  ZoomIn,
  ZoomOut
} from '@material-ui/icons'
import { useSelector } from 'react-redux'
import { YearsTaxesState } from 'ustaxes/redux'
import { Information, TaxYear } from 'ustaxes/core/data'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    dialog: {
      '& .MuiDialog-paper': {
        maxWidth: '900px',
        width: '100%',
        height: '90vh'
      }
    },
    dialogTitle: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.spacing(1, 2)
    },
    dialogContent: {
      padding: theme.spacing(2),
      backgroundColor: '#f5f5f5',
      overflow: 'auto'
    },
    previewContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(3)
    },
    page: {
      width: '8.5in',
      minHeight: '11in',
      padding: '0.5in',
      backgroundColor: 'white',
      boxShadow: theme.shadows[3],
      transformOrigin: 'top center',
      marginBottom: theme.spacing(2),
      position: 'relative',
      '&::after': {
        content: '""',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '2px',
        backgroundColor: '#ccc',
        borderBottom: '2px dashed #999'
      }
    },
    pageBreakIndicator: {
      width: '100%',
      textAlign: 'center',
      color: theme.palette.text.secondary,
      fontSize: '0.75rem',
      padding: theme.spacing(1),
      backgroundColor: '#e0e0e0',
      marginBottom: theme.spacing(2)
    },
    zoomControls: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1)
    },
    dialogActions: {
      padding: theme.spacing(2),
      justifyContent: 'space-between'
    },
    formSection: {
      marginBottom: theme.spacing(2)
    },
    formTitle: {
      fontWeight: 'bold',
      marginBottom: theme.spacing(1)
    },
    formLine: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: theme.spacing(0.5, 0),
      borderBottom: '1px dotted #ccc'
    },
    taxpayerInfo: {
      marginBottom: theme.spacing(3),
      padding: theme.spacing(2),
      border: '1px solid #000'
    }
  })
)

interface PrintPreviewProps {
  open: boolean
  onClose: () => void
  title?: string
  children?: ReactElement | ReactElement[]
}

export const PrintPreview = ({
  open,
  onClose,
  title = 'Print Preview',
  children
}: PrintPreviewProps): ReactElement => {
  const classes = useStyles()
  const [zoom, setZoom] = useState(0.7)
  const printRef = useRef<HTMLDivElement>(null)

  const year: TaxYear = useSelector(
    (state: YearsTaxesState) => state.activeYear
  )
  const info: Information = useSelector(
    (state: YearsTaxesState) => state[state.activeYear]
  )

  const handlePrint = () => {
    window.print()
  }

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.1, 1.5))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.1, 0.3))
  }

  const taxpayerName = info.taxPayer.primaryPerson
    ? `${info.taxPayer.primaryPerson.firstName} ${info.taxPayer.primaryPerson.lastName}`
    : 'Taxpayer'

  const taxYearDisplay = year.replace('Y', '')

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      className={classes.dialog}
    >
      <DialogTitle disableTypography className={classes.dialogTitle}>
        <Typography variant="h6">{title}</Typography>
        <Box className={classes.zoomControls}>
          <IconButton size="small" onClick={handleZoomOut} aria-label="Zoom out">
            <ZoomOut />
          </IconButton>
          <Typography variant="body2">{Math.round(zoom * 100)}%</Typography>
          <IconButton size="small" onClick={handleZoomIn} aria-label="Zoom in">
            <ZoomIn />
          </IconButton>
          <IconButton size="small" onClick={onClose} aria-label="Close preview">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <Divider />
      <DialogContent className={classes.dialogContent}>
        <div className={classes.previewContainer} ref={printRef}>
          {/* Page 1 - Summary */}
          <Paper
            className={classes.page}
            style={{ transform: `scale(${zoom})` }}
            id="print-preview-content"
          >
            <Typography variant="h5" align="center" gutterBottom>
              Tax Return Summary - {taxYearDisplay}
            </Typography>

            <Box className={classes.taxpayerInfo}>
              <Typography variant="subtitle1" className={classes.formTitle}>
                Taxpayer Information
              </Typography>
              <div className={classes.formLine}>
                <span>Name:</span>
                <span>{taxpayerName}</span>
              </div>
              {info.taxPayer.primaryPerson?.ssid && (
                <div className={classes.formLine}>
                  <span>SSN:</span>
                  <span>XXX-XX-{info.taxPayer.primaryPerson.ssid.slice(-4)}</span>
                </div>
              )}
              {info.taxPayer.spouse && (
                <div className={classes.formLine}>
                  <span>Spouse:</span>
                  <span>
                    {info.taxPayer.spouse.firstName} {info.taxPayer.spouse.lastName}
                  </span>
                </div>
              )}
              {info.taxPayer.contactPhoneNumber && (
                <div className={classes.formLine}>
                  <span>Phone:</span>
                  <span>{info.taxPayer.contactPhoneNumber}</span>
                </div>
              )}
            </Box>

            <Box className={classes.formSection}>
              <Typography variant="subtitle1" className={classes.formTitle}>
                Filing Status
              </Typography>
              <div className={classes.formLine}>
                <span>Status:</span>
                <span>{info.taxPayer.filingStatus || 'Not specified'}</span>
              </div>
            </Box>

            {info.taxPayer.dependents && info.taxPayer.dependents.length > 0 && (
              <Box className={classes.formSection}>
                <Typography variant="subtitle1" className={classes.formTitle}>
                  Dependents ({info.taxPayer.dependents.length})
                </Typography>
                {info.taxPayer.dependents.map((dep, idx) => (
                  <div key={idx} className={classes.formLine}>
                    <span>{dep.firstName} {dep.lastName}</span>
                    <span>{dep.relationship}</span>
                  </div>
                ))}
              </Box>
            )}

            {children}
          </Paper>

          <div className={classes.pageBreakIndicator}>
            --- Page Break ---
          </div>

          {/* Page 2 - Income Summary */}
          <Paper
            className={classes.page}
            style={{ transform: `scale(${zoom})` }}
          >
            <Typography variant="h6" gutterBottom>
              Income Summary
            </Typography>

            {info.w2s && info.w2s.length > 0 && (
              <Box className={classes.formSection}>
                <Typography variant="subtitle1" className={classes.formTitle}>
                  W-2 Wage Income
                </Typography>
                {info.w2s.map((w2, idx) => (
                  <div key={idx} className={classes.formLine}>
                    <span>{w2.employer?.employerName || `Employer ${idx + 1}`}</span>
                    <span>${w2.income?.toLocaleString() || '0'}</span>
                  </div>
                ))}
              </Box>
            )}

            {info.f1099s && info.f1099s.length > 0 && (
              <Box className={classes.formSection}>
                <Typography variant="subtitle1" className={classes.formTitle}>
                  1099 Income
                </Typography>
                {info.f1099s.map((f1099, idx) => (
                  <div key={idx} className={classes.formLine}>
                    <span>{f1099.ppiCode || `1099 Form ${idx + 1}`}</span>
                    <span>Various amounts</span>
                  </div>
                ))}
              </Box>
            )}

            <Box className={classes.formSection}>
              <Typography variant="subtitle2" color="textSecondary">
                Note: This is a preview. The actual PDF will contain complete
                IRS form data with all required schedules and attachments.
              </Typography>
            </Box>
          </Paper>
        </div>
      </DialogContent>
      <Divider />
      <DialogActions className={classes.dialogActions}>
        <Typography variant="body2" color="textSecondary">
          Tip: Use the browser&apos;s print function for best results
        </Typography>
        <Box>
          <Button onClick={onClose} color="default">
            Close
          </Button>
          <Button
            onClick={handlePrint}
            color="primary"
            variant="contained"
            startIcon={<PrintIcon />}
          >
            Print
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  )
}

interface PrintPreviewButtonProps {
  variant?: 'text' | 'outlined' | 'contained'
  color?: 'default' | 'primary' | 'secondary'
  size?: 'small' | 'medium' | 'large'
}

export const PrintPreviewButton = ({
  variant = 'outlined',
  color = 'primary',
  size = 'medium'
}: PrintPreviewButtonProps): ReactElement => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant={variant}
        color={color}
        size={size}
        startIcon={<PrintIcon />}
        onClick={() => setOpen(true)}
      >
        Print Preview
      </Button>
      <PrintPreview
        open={open}
        onClose={() => setOpen(false)}
        title="Tax Return Preview"
      />
    </>
  )
}

export default PrintPreview
