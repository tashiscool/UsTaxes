import { ReactElement, useState, useEffect } from 'react'
import { useDispatch, useSelector, TaxesState } from 'ustaxes/redux'
import { Helmet } from 'react-helmet'
import { FormProvider, useForm } from 'react-hook-form'
import { usePager } from 'ustaxes/components/pager'
import {
  LocalTaxInfo as LocalTaxInfoType,
  State,
  Information
} from 'ustaxes/core/data'
import {
  Currency,
  LabeledInput,
  LabeledCheckbox,
  USStateDropDown,
  GenericLabeledDropdown
} from 'ustaxes/components/input'
import { Patterns } from 'ustaxes/components/Patterns'
import { Grid, Box, Paper, Typography, Divider } from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import { LocationCity, Work, Home } from '@material-ui/icons'
import { setLocalTaxInfo } from 'ustaxes/redux/actions'

/**
 * User input interface for local tax information
 */
interface LocalTaxInfoUserInput {
  // Residence information
  residenceCity: string
  residenceState?: State
  isResident: boolean

  // Work location information
  workCity: string
  workState?: State
  worksInDifferentCity: boolean

  // Withholding and payments
  localWithholding: string
  workCityWithholding: string
  estimatedPayments: string
  otherMunicipalTaxPaid: string

  // Ohio-specific fields
  ohioSchoolDistrict: string
  ohioSchoolDistrictNumber: string

  // NYC-specific fields
  nycBorough: string

  // Philadelphia-specific fields
  philadelphiaWageTaxAccountNumber: string
}

const blankLocalTaxInfo: LocalTaxInfoUserInput = {
  residenceCity: '',
  residenceState: undefined,
  isResident: true,
  workCity: '',
  workState: undefined,
  worksInDifferentCity: false,
  localWithholding: '',
  workCityWithholding: '',
  estimatedPayments: '',
  otherMunicipalTaxPaid: '',
  ohioSchoolDistrict: '',
  ohioSchoolDistrictNumber: '',
  nycBorough: '',
  philadelphiaWageTaxAccountNumber: ''
}

/**
 * Convert user input to LocalTaxInfo data type
 */
const toLocalTaxInfo = (input: LocalTaxInfoUserInput): LocalTaxInfoType => ({
  residenceCity: input.residenceCity || undefined,
  residenceState: input.residenceState,
  isResident: input.isResident,
  workCity: input.workCity || undefined,
  workState: input.workState,
  worksInDifferentCity: input.worksInDifferentCity,
  localWithholding: parseFloat(input.localWithholding) || 0,
  workCityWithholding: parseFloat(input.workCityWithholding) || undefined,
  estimatedPayments: parseFloat(input.estimatedPayments) || undefined,
  otherMunicipalTaxPaid: parseFloat(input.otherMunicipalTaxPaid) || undefined,
  ohioSchoolDistrict: input.ohioSchoolDistrict || undefined,
  ohioSchoolDistrictNumber: input.ohioSchoolDistrictNumber || undefined,
  nycBorough: input.nycBorough as LocalTaxInfoType['nycBorough'],
  philadelphiaWageTaxAccountNumber:
    input.philadelphiaWageTaxAccountNumber || undefined
})

/**
 * Convert LocalTaxInfo to user input format
 */
const toLocalTaxInfoUserInput = (
  data: LocalTaxInfoType | undefined
): LocalTaxInfoUserInput => {
  if (!data) return blankLocalTaxInfo

  return {
    residenceCity: data.residenceCity ?? '',
    residenceState: data.residenceState,
    isResident: data.isResident ?? true,
    workCity: data.workCity ?? '',
    workState: data.workState,
    worksInDifferentCity: data.worksInDifferentCity ?? false,
    localWithholding: data.localWithholding?.toString() ?? '',
    workCityWithholding: data.workCityWithholding?.toString() ?? '',
    estimatedPayments: data.estimatedPayments?.toString() ?? '',
    otherMunicipalTaxPaid: data.otherMunicipalTaxPaid?.toString() ?? '',
    ohioSchoolDistrict: data.ohioSchoolDistrict ?? '',
    ohioSchoolDistrictNumber: data.ohioSchoolDistrictNumber ?? '',
    nycBorough: data.nycBorough ?? '',
    philadelphiaWageTaxAccountNumber:
      data.philadelphiaWageTaxAccountNumber ?? ''
  }
}

/**
 * NYC boroughs for dropdown
 */
const nycBoroughs = [
  'Manhattan',
  'Brooklyn',
  'Queens',
  'Bronx',
  'Staten Island'
] as const

/**
 * Common Ohio cities with municipal tax
 */
const ohioCities = [
  'Columbus',
  'Cleveland',
  'Cincinnati',
  'Toledo',
  'Akron',
  'Dayton',
  'Youngstown',
  'Canton',
  'Parma',
  'Lorain',
  'Dublin',
  'Westerville',
  'Other'
]

/**
 * LocalTaxInfo Component
 *
 * This component allows users to enter their local (city/municipal) tax information
 * for jurisdictions that levy local income taxes:
 * - NYC (New York City) - progressive resident tax
 * - Philadelphia - wage tax for residents and non-residents
 * - Ohio municipalities - RITA/CCA administered municipal taxes
 */
export default function LocalTaxInfo(): ReactElement {
  const dispatch = useDispatch()
  const information: Information = useSelector(
    (state: TaxesState) => state.information
  )

  const defaultValues = toLocalTaxInfoUserInput(information.localTaxInfo)
  const methods = useForm<LocalTaxInfoUserInput>({ defaultValues })
  const { watch, reset } = methods

  const { navButtons, onAdvance } = usePager()

  // Watch key fields for conditional rendering
  const residenceState = watch('residenceState')
  const workState = watch('workState')
  const residenceCity = watch('residenceCity')
  const worksInDifferentCity = watch('worksInDifferentCity')

  // Determine which local tax jurisdictions apply
  const [showNYCFields, setShowNYCFields] = useState(false)
  const [showPhiladelphiaFields, setShowPhiladelphiaFields] = useState(false)
  const [showOhioFields, setShowOhioFields] = useState(false)

  useEffect(() => {
    // NYC fields
    const isNYCResident =
      residenceState === 'NY' &&
      (residenceCity?.toLowerCase().includes('new york') ||
        residenceCity?.toLowerCase() === 'nyc' ||
        nycBoroughs.some(b => residenceCity?.toLowerCase() === b.toLowerCase()))
    setShowNYCFields(isNYCResident)

    // Philadelphia fields
    const isPhiladelphiaRelated =
      residenceCity?.toLowerCase() === 'philadelphia' ||
      residenceCity?.toLowerCase() === 'phila' ||
      residenceState === 'PA'
    setShowPhiladelphiaFields(isPhiladelphiaRelated)

    // Ohio fields
    const isOhioRelated = residenceState === 'OH' || workState === 'OH'
    setShowOhioFields(isOhioRelated)
  }, [residenceState, workState, residenceCity])

  // Reset form when information changes
  useEffect(() => {
    reset(toLocalTaxInfoUserInput(information.localTaxInfo))
  }, [information.localTaxInfo, reset])

  const onSubmit = (data: LocalTaxInfoUserInput): void => {
    // Only save if there's meaningful data
    const hasData = data.residenceCity || data.localWithholding
    if (hasData) {
      dispatch(setLocalTaxInfo(toLocalTaxInfo(data)))
    } else {
      dispatch(setLocalTaxInfo(undefined))
    }
  }

  // Check if local tax section is relevant
  const hasLocalTaxState =
    residenceState === 'NY' ||
    residenceState === 'PA' ||
    residenceState === 'OH' ||
    workState === 'NY' ||
    workState === 'PA' ||
    workState === 'OH'

  return (
    <FormProvider {...methods}>
      <form tabIndex={-1} onSubmit={methods.handleSubmit(onSubmit)}>
        <Helmet>
          <title>Local Tax Information | UsTaxes.org</title>
        </Helmet>

        <h2>Local/City Tax Information</h2>

        <Box marginBottom={3}>
          <Alert severity="info">
            Some cities and municipalities levy their own income taxes in
            addition to state and federal taxes. This section helps calculate
            local taxes for NYC, Philadelphia, and Ohio cities.
          </Alert>
        </Box>

        {/* Residence Location Section */}
        <Paper>
          <Box padding={2}>
            <Typography variant="h6">
              <Home style={{ verticalAlign: 'middle', marginRight: 8 }} />
              Residence Location
            </Typography>
            <Divider style={{ margin: '8px 0 16px' }} />

            <Grid container spacing={2}>
              <LabeledInput
                label="City of Residence"
                name="residenceCity"
                required={false}
                sizes={{ xs: 12, md: 6 }}
              />
              <USStateDropDown
                name="residenceState"
                label="State"
              />
            </Grid>

            {/* NYC Borough Selection */}
            {showNYCFields && (
              <Box marginTop={2}>
                <Grid container spacing={2}>
                  <GenericLabeledDropdown
                    dropDownData={[...nycBoroughs]}
                    label="NYC Borough"
                    name="nycBorough"
                    valueMapping={(b) => b}
                    keyMapping={(b, i) => i}
                    textMapping={(b) => b}
                    required={false}
                  />
                </Grid>
              </Box>
            )}
          </Box>
        </Paper>

        {/* Work Location Section */}
        <Box marginTop={3}>
          <Paper>
            <Box padding={2}>
              <Typography variant="h6">
                <Work style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Work Location
              </Typography>
              <Divider style={{ margin: '8px 0 16px' }} />

              <Grid container spacing={2}>
                <LabeledCheckbox
                  name="worksInDifferentCity"
                  label="I work in a different city than where I live"
                />
              </Grid>

              {worksInDifferentCity && (
                <Grid container spacing={2}>
                  <LabeledInput
                    label="City Where You Work"
                    name="workCity"
                    required={false}
                    sizes={{ xs: 12, md: 6 }}
                  />
                  <USStateDropDown
                    name="workState"
                    label="Work State"
                  />
                </Grid>
              )}
            </Box>
          </Paper>
        </Box>

        {/* Local Tax Withholding Section */}
        {hasLocalTaxState && (
          <Box marginTop={3}>
            <Paper>
              <Box padding={2}>
                <Typography variant="h6">
                  <LocationCity
                    style={{ verticalAlign: 'middle', marginRight: 8 }}
                  />
                  Local Tax Withholding & Payments
                </Typography>
                <Divider style={{ margin: '8px 0 16px' }} />

                <Grid container spacing={2}>
                  <LabeledInput
                    label="Local Tax Withheld (Residence City)"
                    name="localWithholding"
                    patternConfig={Patterns.currency}
                    required={false}
                    sizes={{ xs: 12, md: 6 }}
                  />
                  {worksInDifferentCity && (
                    <LabeledInput
                      label="Work City Tax Withheld"
                      name="workCityWithholding"
                      patternConfig={Patterns.currency}
                      required={false}
                      sizes={{ xs: 12, md: 6 }}
                    />
                  )}
                  <LabeledInput
                    label="Estimated Local Tax Payments Made"
                    name="estimatedPayments"
                    patternConfig={Patterns.currency}
                    required={false}
                    sizes={{ xs: 12, md: 6 }}
                  />
                  <LabeledInput
                    label="Taxes Paid to Other Municipalities (for credit)"
                    name="otherMunicipalTaxPaid"
                    patternConfig={Patterns.currency}
                    required={false}
                    sizes={{ xs: 12, md: 6 }}
                  />
                </Grid>
              </Box>
            </Paper>
          </Box>
        )}

        {/* Ohio-Specific Fields */}
        {showOhioFields && (
          <Box marginTop={3}>
            <Paper>
              <Box padding={2}>
                <Typography variant="h6">Ohio Municipal Tax Information</Typography>
                <Divider style={{ margin: '8px 0 16px' }} />

                <Alert severity="info" style={{ marginBottom: 16 }}>
                  Ohio has over 600 cities and villages with municipal income
                  taxes. Most are administered by RITA (Regional Income Tax
                  Agency) or CCA (Central Collection Agency for Cleveland area).
                </Alert>

                <Grid container spacing={2}>
                  <LabeledInput
                    label="School District Name"
                    name="ohioSchoolDistrict"
                    required={false}
                    sizes={{ xs: 12, md: 6 }}
                  />
                  <LabeledInput
                    label="School District Number"
                    name="ohioSchoolDistrictNumber"
                    required={false}
                    sizes={{ xs: 12, md: 6 }}
                  />
                </Grid>

                <Box marginTop={2}>
                  <Typography variant="body2" color="textSecondary">
                    Common Ohio city tax rates: Columbus (2.5%), Cleveland
                    (2.5%), Cincinnati (1.8%), Toledo (2.25%), Akron (2.5%)
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Box>
        )}

        {/* Philadelphia-Specific Fields */}
        {showPhiladelphiaFields && (
          <Box marginTop={3}>
            <Paper>
              <Box padding={2}>
                <Typography variant="h6">
                  Philadelphia Wage Tax Information
                </Typography>
                <Divider style={{ margin: '8px 0 16px' }} />

                <Alert severity="info" style={{ marginBottom: 16 }}>
                  Philadelphia imposes a wage tax on all wages earned by
                  residents (3.75%) and non-residents who work in Philadelphia
                  (3.44%). Self-employed individuals also pay Net Profits Tax.
                </Alert>

                <Grid container spacing={2}>
                  <LabeledInput
                    label="Philadelphia Wage Tax Account Number"
                    name="philadelphiaWageTaxAccountNumber"
                    required={false}
                    sizes={{ xs: 12, md: 6 }}
                  />
                </Grid>
              </Box>
            </Paper>
          </Box>
        )}

        {/* NYC-Specific Information */}
        {showNYCFields && (
          <Box marginTop={3}>
            <Paper>
              <Box padding={2}>
                <Typography variant="h6">
                  New York City Resident Tax Information
                </Typography>
                <Divider style={{ margin: '8px 0 16px' }} />

                <Alert severity="info">
                  NYC residents pay an additional city income tax ranging from
                  3.078% to 3.876% based on income. NYC tax is calculated on
                  your NYC-201 form, which is filed along with your NY State
                  IT-201.
                </Alert>

                <Box marginTop={2}>
                  <Typography variant="body2" color="textSecondary">
                    Available credits: NYC School Tax Credit, NYC Household
                    Credit
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Box>
        )}

        {/* Summary Section */}
        {hasLocalTaxState && information.localTaxInfo && (
          <Box marginTop={3}>
            <Paper>
              <Box padding={2}>
                <Typography variant="h6">Current Local Tax Summary</Typography>
                <Divider style={{ margin: '8px 0 16px' }} />

                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2">
                      <strong>Residence City:</strong>{' '}
                      {information.localTaxInfo.residenceCity ?? 'Not specified'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2">
                      <strong>Local Tax Withheld:</strong>{' '}
                      <Currency
                        value={information.localTaxInfo.localWithholding ?? 0}
                      />
                    </Typography>
                  </Grid>
                  {information.localTaxInfo.workCity &&
                    information.localTaxInfo.workCity !==
                      information.localTaxInfo.residenceCity && (
                      <>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2">
                            <strong>Work City:</strong>{' '}
                            {information.localTaxInfo.workCity}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2">
                            <strong>Work City Tax Withheld:</strong>{' '}
                            <Currency
                              value={
                                information.localTaxInfo.workCityWithholding ?? 0
                              }
                            />
                          </Typography>
                        </Grid>
                      </>
                    )}
                </Grid>
              </Box>
            </Paper>
          </Box>
        )}

        <Box marginTop={3}>{navButtons}</Box>
      </form>
    </FormProvider>
  )
}
