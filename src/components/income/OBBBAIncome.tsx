/**
 * OBBBAIncome.tsx
 *
 * UI Component for OBBBA 2025 income provisions:
 * - Overtime Income Exemption
 * - Tip Income Exemption
 * - Auto Loan Interest Deduction
 *
 * Source: docs/obbba/new-provisions/
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars */

import { ReactElement, useState } from 'react'
import { Helmet } from 'react-helmet'
import { useForm, FormProvider } from 'react-hook-form'
import { useDispatch, useSelector, TaxesState } from 'ustaxes/redux'
import {
  setOvertimeIncome,
  setTipIncome,
  setAutoLoanInterest
} from 'ustaxes/redux/actions'
import { usePager } from 'ustaxes/components/pager'
import { OvertimeIncome, TipIncome, AutoLoanInterest } from 'ustaxes/core/data'
import { LabeledInput, LabeledCheckbox } from 'ustaxes/components/input'
import { Patterns } from 'ustaxes/components/Patterns'
import { Grid, Typography, Paper, Box, Divider } from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import { intentionallyFloat } from 'ustaxes/core/util'

interface OBBBAIncomeUserInput {
  // Overtime Income
  hasOvertimeIncome: boolean
  overtimeAmount: string | number

  // Tip Income
  hasTipIncome: boolean
  tipAmount: string | number

  // Auto Loan Interest
  hasAutoLoanInterest: boolean
  autoLoanInterestAmount: string | number
  isDomesticVehicle: boolean
  vehicleMake: string
  vehicleModel: string
  vehicleYear: string | number
}

const blankOBBBAInput: OBBBAIncomeUserInput = {
  hasOvertimeIncome: false,
  overtimeAmount: '',
  hasTipIncome: false,
  tipAmount: '',
  hasAutoLoanInterest: false,
  autoLoanInterestAmount: '',
  isDomesticVehicle: false,
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: ''
}

const toOvertimeIncome = (
  input: OBBBAIncomeUserInput
): OvertimeIncome | undefined => {
  if (!input.hasOvertimeIncome || !input.overtimeAmount) {
    return undefined
  }
  return {
    amount: Number(input.overtimeAmount)
  }
}

const toTipIncome = (input: OBBBAIncomeUserInput): TipIncome | undefined => {
  if (!input.hasTipIncome || !input.tipAmount) {
    return undefined
  }
  return {
    amount: Number(input.tipAmount)
  }
}

const toAutoLoanInterest = (
  input: OBBBAIncomeUserInput
): AutoLoanInterest | undefined => {
  if (!input.hasAutoLoanInterest || !input.autoLoanInterestAmount) {
    return undefined
  }
  return {
    amount: Number(input.autoLoanInterestAmount),
    domesticManufacture: input.isDomesticVehicle,
    vehicleMake: input.vehicleMake || undefined,
    vehicleModel: input.vehicleModel || undefined,
    vehicleYear: input.vehicleYear ? Number(input.vehicleYear) : undefined
  }
}

export const OBBBAIncome = (): ReactElement => {
  const info = useSelector((state: TaxesState) => state.information)

  // Convert existing state to form defaults
  const defaultValues: OBBBAIncomeUserInput = {
    hasOvertimeIncome: info.overtimeIncome !== undefined,
    overtimeAmount: info.overtimeIncome?.amount ?? '',
    hasTipIncome: info.tipIncome !== undefined,
    tipAmount: info.tipIncome?.amount ?? '',
    hasAutoLoanInterest: info.autoLoanInterest !== undefined,
    autoLoanInterestAmount: info.autoLoanInterest?.amount ?? '',
    isDomesticVehicle: info.autoLoanInterest?.domesticManufacture ?? false,
    vehicleMake: info.autoLoanInterest?.vehicleMake ?? '',
    vehicleModel: info.autoLoanInterest?.vehicleModel ?? '',
    vehicleYear: info.autoLoanInterest?.vehicleYear ?? ''
  }

  const methods = useForm<OBBBAIncomeUserInput>({ defaultValues })
  const { handleSubmit, watch } = methods

  const hasOvertimeIncome = watch('hasOvertimeIncome')
  const hasTipIncome = watch('hasTipIncome')
  const hasAutoLoanInterest = watch('hasAutoLoanInterest')
  const isDomesticVehicle = watch('isDomesticVehicle')

  const dispatch = useDispatch()
  const { onAdvance, navButtons } = usePager()

  const onSubmit = (formData: OBBBAIncomeUserInput): void => {
    dispatch(setOvertimeIncome(toOvertimeIncome(formData)))
    dispatch(setTipIncome(toTipIncome(formData)))
    dispatch(setAutoLoanInterest(toAutoLoanInterest(formData)))
  }

  return (
    <>
      <Helmet>
        <title>OBBBA Deductions | Income | UsTaxes.org</title>
      </Helmet>

      <h2>OBBBA 2025 Tax Deductions</h2>

      <Alert severity="info" style={{ marginBottom: '20px' }}>
        The One Big Beautiful Bill Act (OBBBA) introduced new above-the-line
        deductions for tax year 2025. These deductions reduce your taxable
        income even if you don&apos;t itemize.
      </Alert>

      <FormProvider {...methods}>
        <form
          tabIndex={-1}
          onSubmit={intentionallyFloat(
            handleSubmit((data) => {
              onSubmit(data)
              onAdvance()
            })
          )}
        >
          <Grid container spacing={3}>
            {/* Overtime Income Exemption */}
            <Grid item xs={12}>
              <Paper elevation={2} style={{ padding: '20px' }}>
                <Typography variant="h6" gutterBottom>
                  Overtime Income Exemption
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  If you received overtime pay (time-and-a-half), the premium
                  portion above your regular wage may be deductible. Cap:
                  $12,500 (Single) / $25,000 (MFJ).
                </Typography>

                <LabeledCheckbox
                  name="hasOvertimeIncome"
                  label="I received overtime pay in 2025"
                />

                {hasOvertimeIncome && (
                  <Box mt={2}>
                    <LabeledInput
                      name="overtimeAmount"
                      label="Total qualified overtime premium (the extra 0.5x portion)"
                      patternConfig={Patterns.currency}
                      required={hasOvertimeIncome}
                    />
                    <Alert severity="warning" style={{ marginTop: '10px' }}>
                      Only enter the PREMIUM portion of overtime (the extra
                      0.5x), not the total overtime pay. For example, if you
                      earned $30/hr overtime (1.5x of $20 regular), enter only
                      the $10 premium multiplied by hours worked.
                    </Alert>
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* Tip Income Exemption */}
            <Grid item xs={12}>
              <Paper elevation={2} style={{ padding: '20px' }}>
                <Typography variant="h6" gutterBottom>
                  Tip Income Exemption
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  If you received tip income, you may deduct up to $25,000 of
                  tips from your taxable income. Tips must be reported to your
                  employer.
                </Typography>

                <LabeledCheckbox
                  name="hasTipIncome"
                  label="I received tip income in 2025"
                />

                {hasTipIncome && (
                  <Box mt={2}>
                    <LabeledInput
                      name="tipAmount"
                      label="Total tip income (from W-2 Box 7 or daily records)"
                      patternConfig={Patterns.currency}
                      required={hasTipIncome}
                    />
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* Auto Loan Interest Deduction */}
            <Grid item xs={12}>
              <Paper elevation={2} style={{ padding: '20px' }}>
                <Typography variant="h6" gutterBottom>
                  Auto Loan Interest Deduction
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Interest paid on auto loans for vehicles manufactured in the
                  United States may be deductible. Cap: $10,000.
                </Typography>

                <LabeledCheckbox
                  name="hasAutoLoanInterest"
                  label="I paid interest on an auto loan in 2025"
                />

                {hasAutoLoanInterest && (
                  <Box mt={2}>
                    <LabeledCheckbox
                      name="isDomesticVehicle"
                      label="Vehicle was manufactured in the United States"
                    />

                    {isDomesticVehicle && (
                      <>
                        <Grid container spacing={2}>
                          <Grid item xs={4}>
                            <LabeledInput
                              name="vehicleMake"
                              label="Vehicle Make"
                            />
                          </Grid>
                          <Grid item xs={4}>
                            <LabeledInput
                              name="vehicleModel"
                              label="Vehicle Model"
                            />
                          </Grid>
                          <Grid item xs={4}>
                            <LabeledInput
                              name="vehicleYear"
                              label="Vehicle Year"
                              patternConfig={Patterns.year}
                            />
                          </Grid>
                        </Grid>

                        <LabeledInput
                          name="autoLoanInterestAmount"
                          label="Total auto loan interest paid in 2025"
                          patternConfig={Patterns.currency}
                          required={hasAutoLoanInterest && isDomesticVehicle}
                        />
                      </>
                    )}

                    {!isDomesticVehicle && (
                      <Alert severity="warning" style={{ marginTop: '10px' }}>
                        The auto loan interest deduction only applies to
                        vehicles manufactured in the United States. Foreign-made
                        vehicles do not qualify.
                      </Alert>
                    )}
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>

          {navButtons}
        </form>
      </FormProvider>
    </>
  )
}

export default OBBBAIncome
