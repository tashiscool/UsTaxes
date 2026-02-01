/**
 * DocumentScanner Component
 *
 * Main UI for document OCR scanning functionality.
 * Allows users to upload or capture tax documents and automatically
 * extract data using Tesseract.js OCR.
 */

import { ReactElement, useState, useRef, useCallback, useEffect } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography
} from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import {
  CameraAlt,
  CloudUpload,
  Check,
  Warning,
  Error as ErrorIcon
} from '@material-ui/icons'
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles'
import { useDispatch } from 'ustaxes/redux'
import { addW2, add1099 } from 'ustaxes/redux/actions'
import {
  IncomeW2,
  PersonRole,
  Supported1099,
  Income1099Type
} from 'ustaxes/core/data'
import {
  scanDocument,
  DocumentScanResult,
  DocumentType,
  DOCUMENT_TYPE_LABELS,
  PreprocessedImage,
  ExtractedField
} from 'ustaxes/core/ocr'
import { loadImage } from 'ustaxes/core/ocr/imagePreprocessor'
import { intentionallyFloat } from 'ustaxes/core/util'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      padding: theme.spacing(2)
    },
    uploadArea: {
      border: `2px dashed ${theme.palette.divider}`,
      borderRadius: theme.shape.borderRadius,
      padding: theme.spacing(4),
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'border-color 0.2s, background-color 0.2s',
      '&:hover': {
        borderColor: theme.palette.primary.main,
        backgroundColor: theme.palette.action.hover
      }
    },
    uploadAreaDragging: {
      borderColor: theme.palette.primary.main,
      backgroundColor: theme.palette.action.selected
    },
    hiddenInput: {
      display: 'none'
    },
    previewContainer: {
      position: 'relative',
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2)
    },
    previewImage: {
      maxWidth: '100%',
      maxHeight: '500px',
      objectFit: 'contain',
      display: 'block',
      margin: '0 auto'
    },
    overlayCanvas: {
      position: 'absolute',
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      pointerEvents: 'none'
    },
    fieldCard: {
      marginBottom: theme.spacing(1)
    },
    fieldLabel: {
      fontWeight: 500
    },
    confidenceHigh: {
      color: theme.palette.success.main
    },
    confidenceMedium: {
      color: theme.palette.warning.main
    },
    confidenceLow: {
      color: theme.palette.error.main
    },
    confidenceIndicator: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5)
    },
    buttonGroup: {
      display: 'flex',
      gap: theme.spacing(1),
      marginTop: theme.spacing(2)
    },
    progressContainer: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2)
    },
    resultSection: {
      marginTop: theme.spacing(2)
    },
    scanInfo: {
      marginTop: theme.spacing(1),
      color: theme.palette.text.secondary,
      fontSize: '0.875rem'
    }
  })
)

/**
 * Field editor for manual correction
 */
interface FieldEditorProps {
  field: ExtractedField
  fieldId: string
  onUpdate: (fieldId: string, value: string) => void
}

const FieldEditor = ({
  field,
  fieldId,
  onUpdate
}: FieldEditorProps): ReactElement => {
  const classes = useStyles()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(field.value)

  const confidenceClass =
    field.confidence >= 0.8
      ? classes.confidenceHigh
      : field.confidence >= 0.5
      ? classes.confidenceMedium
      : classes.confidenceLow

  const ConfidenceIcon =
    field.confidence >= 0.8
      ? Check
      : field.confidence >= 0.5
      ? Warning
      : ErrorIcon

  const handleSave = () => {
    onUpdate(fieldId, value)
    setEditing(false)
  }

  return (
    <Card className={classes.fieldCard} variant="outlined">
      <CardContent>
        <Grid container spacing={1} alignItems="center">
          <Grid item xs={12} sm={4}>
            <Typography className={classes.fieldLabel}>
              {field.label}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={5}>
            {editing ? (
              <TextField
                fullWidth
                size="small"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave()
                  if (e.key === 'Escape') setEditing(false)
                }}
                autoFocus
              />
            ) : (
              <Typography
                onClick={() => setEditing(true)}
                style={{ cursor: 'pointer' }}
              >
                {field.value || <em>No value detected</em>}
              </Typography>
            )}
          </Grid>
          <Grid item xs={12} sm={3}>
            <Box className={classes.confidenceIndicator}>
              <ConfidenceIcon className={confidenceClass} fontSize="small" />
              <Typography variant="body2" className={confidenceClass}>
                {Math.round(field.confidence * 100)}%
              </Typography>
              {!editing && (
                <Button size="small" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )}
              {editing && (
                <Button size="small" color="primary" onClick={handleSave}>
                  Save
                </Button>
              )}
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}

/**
 * Main DocumentScanner component
 */
export default function DocumentScanner(): ReactElement {
  const classes = useStyles()
  const dispatch = useDispatch()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [documentType, setDocumentType] = useState<DocumentType>('W-2')
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanResult, setScanResult] = useState<DocumentScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [editedFields, setEditedFields] = useState<Map<string, string>>(
    new Map()
  )

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, etc.)')
      return
    }

    setSelectedFile(file)
    setError(null)
    setScanResult(null)
    setEditedFields(new Map())

    // Create preview URL
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }, [])

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  // Trigger file input click
  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  // Scan document
  const handleScan = async () => {
    if (!selectedFile) {
      setError('Please select a file first')
      return
    }

    setIsScanning(true)
    setScanProgress(0)
    setError(null)

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setScanProgress((prev) => Math.min(prev + 10, 90))
      }, 200)

      const result = await scanDocument(selectedFile, documentType)

      clearInterval(progressInterval)
      setScanProgress(100)
      setScanResult(result)

      // Draw bounding boxes on preview
      drawBoundingBoxes(result)
    } catch (err) {
      console.error('Scan error:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'An error occurred while scanning the document'
      )
    } finally {
      setIsScanning(false)
    }
  }

  // Draw bounding boxes on detected fields
  const drawBoundingBoxes = (result: DocumentScanResult) => {
    const canvas = canvasRef.current
    const previewImg = document.querySelector(
      `.${classes.previewImage}`
    ) as HTMLImageElement

    if (!canvas || !previewImg || !result.extractionResult?.result) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match preview image
    canvas.width = previewImg.clientWidth
    canvas.height = previewImg.clientHeight

    // Calculate scale factors
    const scaleX = canvas.width / result.preprocessedImage.originalWidth
    const scaleY = canvas.height / result.preprocessedImage.originalHeight

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw boxes for each extracted field
    const fields = result.extractionResult.result.fields
    if (fields) {
      fields.forEach((field) => {
        if (field.bbox) {
          const { x0, y0, x1, y1 } = field.bbox

          // Set color based on confidence
          if (field.confidence >= 0.8) {
            ctx.strokeStyle = '#4caf50'
            ctx.fillStyle = 'rgba(76, 175, 80, 0.1)'
          } else if (field.confidence >= 0.5) {
            ctx.strokeStyle = '#ff9800'
            ctx.fillStyle = 'rgba(255, 152, 0, 0.1)'
          } else {
            ctx.strokeStyle = '#f44336'
            ctx.fillStyle = 'rgba(244, 67, 54, 0.1)'
          }

          ctx.lineWidth = 2

          // Draw rectangle
          const rectX = x0 * scaleX
          const rectY = y0 * scaleY
          const rectW = (x1 - x0) * scaleX
          const rectH = (y1 - y0) * scaleY

          ctx.fillRect(rectX, rectY, rectW, rectH)
          ctx.strokeRect(rectX, rectY, rectW, rectH)
        }
      })
    }
  }

  // Handle field update
  const handleFieldUpdate = (fieldId: string, value: string) => {
    setEditedFields((prev) => new Map(prev).set(fieldId, value))
  }

  // Import extracted data
  const handleImport = () => {
    if (!scanResult?.extractionResult?.result) {
      setError('No data to import')
      return
    }

    const { type, result } = scanResult.extractionResult

    try {
      switch (type) {
        case 'W-2': {
          const w2Data = result.w2Data 

          // Apply edited fields
          editedFields.forEach((value, fieldId) => {
            const numValue = parseFloat(value)
            switch (fieldId) {
              case 'wages':
                w2Data.income = isNaN(numValue) ? 0 : numValue
                break
              case 'federalWithholding':
                w2Data.fedWithholding = isNaN(numValue) ? 0 : numValue
                break
              case 'ssWages':
                w2Data.ssWages = isNaN(numValue) ? 0 : numValue
                break
              case 'ssWithholding':
                w2Data.ssWithholding = isNaN(numValue) ? 0 : numValue
                break
              case 'medicareWages':
                w2Data.medicareIncome = isNaN(numValue) ? 0 : numValue
                break
              case 'medicareWithholding':
                w2Data.medicareWithholding = isNaN(numValue) ? 0 : numValue
                break
              case 'stateWages':
                w2Data.stateWages = isNaN(numValue) ? 0 : numValue
                break
              case 'stateWithholding':
                w2Data.stateWithholding = isNaN(numValue) ? 0 : numValue
                break
              case 'employerName':
                if (!w2Data.employer) w2Data.employer = {}
                w2Data.employer.employerName = value
                break
            }
          })

          // Ensure required fields have values
          const completeW2: IncomeW2 = {
            occupation: '',
            income: w2Data.income ?? 0,
            medicareIncome: w2Data.medicareIncome ?? 0,
            fedWithholding: w2Data.fedWithholding ?? 0,
            ssWages: w2Data.ssWages ?? 0,
            ssWithholding: w2Data.ssWithholding ?? 0,
            medicareWithholding: w2Data.medicareWithholding ?? 0,
            personRole: PersonRole.PRIMARY,
            employer: w2Data.employer,
            state: w2Data.state,
            stateWages: w2Data.stateWages,
            stateWithholding: w2Data.stateWithholding
          }

          dispatch(addW2(completeW2))
          break
        }

        case '1099-INT': {
          const intData = result.f1099IntData as Partial<Supported1099>
          if (intData.type === Income1099Type.INT) {
            const payer = editedFields.get('payerName') ?? intData.payer ?? ''
            const income =
              parseFloat(editedFields.get('interestIncome') ?? '') ??
              intData.form?.income ??
              0

            const complete1099Int: Supported1099 = {
              type: Income1099Type.INT,
              payer,
              personRole: PersonRole.PRIMARY,
              form: { income }
            }

            dispatch(add1099(complete1099Int))
          }
          break
        }

        case '1099-DIV': {
          const divData = result.f1099DivData as Partial<Supported1099>
          if (divData.type === Income1099Type.DIV) {
            const payer = editedFields.get('payerName') ?? divData.payer ?? ''
            const dividends =
              parseFloat(editedFields.get('totalOrdinaryDividends') ?? '') ??
              divData.form?.dividends ??
              0
            const qualifiedDividends =
              parseFloat(editedFields.get('qualifiedDividends') ?? '') ??
              divData.form?.qualifiedDividends ??
              0
            const totalCapitalGainsDistributions =
              parseFloat(editedFields.get('totalCapitalGain') ?? '') ??
              divData.form?.totalCapitalGainsDistributions ??
              0

            const complete1099Div: Supported1099 = {
              type: Income1099Type.DIV,
              payer,
              personRole: PersonRole.PRIMARY,
              form: {
                dividends,
                qualifiedDividends,
                totalCapitalGainsDistributions
              }
            }

            dispatch(add1099(complete1099Div))
          }
          break
        }

        case '1099-MISC': {
          const miscData = result.f1099MiscData as Partial<Supported1099>
          if (miscData.type === Income1099Type.MISC) {
            const payer = editedFields.get('payerName') ?? miscData.payer ?? ''
            const rents =
              parseFloat(editedFields.get('rents') ?? '') ??
              miscData.form?.rents
            const royalties =
              parseFloat(editedFields.get('royalties') ?? '') ??
              miscData.form?.royalties
            const otherIncome =
              parseFloat(editedFields.get('otherIncome') ?? '') ??
              miscData.form?.otherIncome
            const federalIncomeTaxWithheld =
              parseFloat(editedFields.get('federalWithholding') ?? '') ??
              miscData.form?.federalIncomeTaxWithheld

            const complete1099Misc: Supported1099 = {
              type: Income1099Type.MISC,
              payer,
              personRole: PersonRole.PRIMARY,
              form: {
                rents,
                royalties,
                otherIncome,
                federalIncomeTaxWithheld
              }
            }

            dispatch(add1099(complete1099Misc))
          }
          break
        }

        default: {
          const _exhaustiveCheck: never = type
          setError(`Import not yet supported for ${String(_exhaustiveCheck)} documents`)
          return
        }
      }

      // Reset state after successful import
      setSelectedFile(null)
      setPreviewUrl(null)
      setScanResult(null)
      setEditedFields(new Map())

      // Show success (could add a toast/snackbar here)
      alert('Document data imported successfully!')
    } catch (err) {
      console.error('Import error:', err)
      setError('Failed to import document data')
    }
  }

  // Reset scanner
  const handleReset = () => {
    setSelectedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setScanResult(null)
    setError(null)
    setEditedFields(new Map())
    setScanProgress(0)
  }

  return (
    <Box className={classes.root}>
      <Typography variant="h5" gutterBottom>
        Document Scanner
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Upload or photograph your tax documents to automatically extract data
        using OCR. Supported formats: W-2, 1099-INT, 1099-DIV, 1099-MISC.
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Document type selector */}
      <FormControl fullWidth margin="normal">
        <InputLabel id="document-type-label">Document Type</InputLabel>
        <Select
          labelId="document-type-label"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value as DocumentType)}
          disabled={isScanning}
        >
          {Object.entries(DOCUMENT_TYPE_LABELS).map(([type, label]) => (
            <MenuItem key={type} value={type}>
              {label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* File upload area */}
      {!selectedFile && (
        <Paper
          className={`${classes.uploadArea} ${
            isDragging ? classes.uploadAreaDragging : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleUploadClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className={classes.hiddenInput}
            onChange={handleFileInputChange}
          />
          <CloudUpload style={{ fontSize: 48, marginBottom: 16 }} />
          <Typography variant="h6">
            Drag and drop an image here, or click to upload
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Supports JPEG, PNG, and other image formats
          </Typography>
          <Box className={classes.buttonGroup} justifyContent="center">
            <Button
              variant="outlined"
              startIcon={<CloudUpload />}
              onClick={(e) => {
                e.stopPropagation()
                handleUploadClick()
              }}
            >
              Upload File
            </Button>
            <Button
              variant="outlined"
              startIcon={<CameraAlt />}
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
            >
              Take Photo
            </Button>
          </Box>
        </Paper>
      )}

      {/* Preview and scan controls */}
      {selectedFile && (
        <>
          <Box className={classes.previewContainer}>
            {previewUrl && (
              <>
                <img
                  src={previewUrl}
                  alt="Document preview"
                  className={classes.previewImage}
                  onLoad={() => {
                    if (scanResult) {
                      drawBoundingBoxes(scanResult)
                    }
                  }}
                />
                <canvas ref={canvasRef} className={classes.overlayCanvas} />
              </>
            )}
          </Box>

          {/* Progress indicator */}
          {isScanning && (
            <Box className={classes.progressContainer}>
              <Typography variant="body2" gutterBottom>
                Scanning document...
              </Typography>
              <LinearProgress variant="determinate" value={scanProgress} />
            </Box>
          )}

          {/* Action buttons */}
          <Box className={classes.buttonGroup}>
            <Button
              variant="contained"
              color="primary"
              onClick={intentionallyFloat(handleScan)}
              disabled={isScanning}
              startIcon={
                isScanning ? <CircularProgress size={20} /> : undefined
              }
            >
              {isScanning ? 'Scanning...' : 'Scan Document'}
            </Button>
            <Button
              variant="outlined"
              onClick={handleReset}
              disabled={isScanning}
            >
              Reset
            </Button>
          </Box>
        </>
      )}

      {/* Scan results */}
      {scanResult?.extractionResult?.result && (
        <Box className={classes.resultSection}>
          <Typography variant="h6" gutterBottom>
            Extracted Fields
          </Typography>

          {scanResult.extractionResult.result.missingRequired.length > 0 && (
            <Alert severity="warning" style={{ marginBottom: 16 }}>
              Some required fields could not be detected:{' '}
              {scanResult.extractionResult.result.missingRequired.join(', ')}
            </Alert>
          )}

          {/* Field editors */}
          {Array.from(scanResult.extractionResult.result.fields.entries()).map(
            ([fieldId, field]) => (
              <FieldEditor
                key={fieldId}
                fieldId={fieldId}
                field={field}
                onUpdate={handleFieldUpdate}
              />
            )
          )}

          {/* Overall confidence */}
          <Typography className={classes.scanInfo}>
            Overall confidence:{' '}
            {Math.round(scanResult.extractionResult.result.confidence * 100)}% |
            Processing time: {Math.round(scanResult.processingTimeMs)}ms
          </Typography>

          {/* Import button */}
          <Box className={classes.buttonGroup}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleImport}
              startIcon={<Check />}
            >
              Confirm and Import
            </Button>
            <Button variant="outlined" onClick={handleReset}>
              Cancel
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  )
}
