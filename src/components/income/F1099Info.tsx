import { ReactElement } from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import Alert from '@material-ui/lab/Alert'
import { useForm, FormProvider } from 'react-hook-form'
import { Icon, Grid } from '@material-ui/core'
import { useDispatch, useSelector, TaxesState } from 'ustaxes/redux'
import { add1099, edit1099, remove1099 } from 'ustaxes/redux/actions'
import { usePager } from 'ustaxes/components/pager'
import {
  Person,
  PersonRole,
  Supported1099,
  Income1099Type,
  PlanType1099,
  PlanType1099Texts,
  State
} from 'ustaxes/core/data'
import {
  Currency,
  formatSSID,
  GenericLabeledDropdown,
  LabeledInput,
  boxLabel
} from 'ustaxes/components/input'
import { Patterns } from 'ustaxes/components/Patterns'
import { FormListContainer } from 'ustaxes/components/FormContainer'
import { intentionallyFloat } from 'ustaxes/core/util'

const showIncome = (a: Supported1099): ReactElement => {
  switch (a.type) {
    case Income1099Type.INT: {
      return <Currency value={a.form.income} />
    }
    case Income1099Type.B: {
      const ltg = a.form.longTermProceeds - a.form.longTermCostBasis
      const stg = a.form.shortTermProceeds - a.form.shortTermCostBasis
      return (
        <span>
          Long term: <Currency value={ltg} />
          <br />
          Short term: <Currency value={stg} />
        </span>
      )
    }
    case Income1099Type.DIV: {
      return <Currency value={a.form.dividends} />
    }
    case Income1099Type.R: {
      return (
        <span>
          Plan Type: {a.form.planType}
          <br />
          Gross Distribution: <Currency value={a.form.grossDistribution} />
          <br />
          Taxable Amount: <Currency value={a.form.taxableAmount} />
          <br />
          Federal Income Tax Withheld:{' '}
          <Currency value={a.form.federalIncomeTaxWithheld} />
        </span>
      )
    }
    case Income1099Type.SSA: {
      return (
        <span>
          {/* Benefits Paid: <Currency value={a.form.benefitsPaid} />
          <br />
          Benefits Repaid: <Currency value={a.form.benefitsRepaid} />
          <br /> */}
          Net Benefits: <Currency value={a.form.netBenefits} />
          <br />
          Federal Income Tax Withweld:{' '}
          <Currency value={a.form.federalIncomeTaxWithheld} />
        </span>
      )
    }
    case Income1099Type.NEC: {
      return (
        <span>
          Nonemployee Compensation:{' '}
          <Currency value={a.form.nonemployeeCompensation} />
          {a.form.federalIncomeTaxWithheld && (
            <>
              <br />
              Federal Withholding:{' '}
              <Currency value={a.form.federalIncomeTaxWithheld} />
            </>
          )}
        </span>
      )
    }
    case Income1099Type.MISC: {
      const total =
        (a.form.rents ?? 0) +
        (a.form.royalties ?? 0) +
        (a.form.otherIncome ?? 0)
      return (
        <span>
          Total Misc Income: <Currency value={total} />
          {a.form.rents && (
            <>
              <br />
              Rents: <Currency value={a.form.rents} />
            </>
          )}
          {a.form.royalties && (
            <>
              <br />
              Royalties: <Currency value={a.form.royalties} />
            </>
          )}
        </span>
      )
    }
    case Income1099Type.G: {
      return (
        <span>
          {a.form.unemploymentCompensation && (
            <>
              Unemployment: <Currency value={a.form.unemploymentCompensation} />
              <br />
            </>
          )}
          {a.form.stateLocalTaxRefund && (
            <>
              State Tax Refund: <Currency value={a.form.stateLocalTaxRefund} />
            </>
          )}
        </span>
      )
    }
  }
}

interface F1099UserInput {
  formType: Income1099Type | undefined
  payer: string
  // Int fields
  interest: string | number
  // B Fields
  shortTermProceeds: string | number
  shortTermCostBasis: string | number
  longTermProceeds: string | number
  longTermCostBasis: string | number
  // Div fields
  dividends: string | number
  qualifiedDividends: string | number
  totalCapitalGainsDistributions: string | number
  personRole?: PersonRole.PRIMARY | PersonRole.SPOUSE
  // R fields
  grossDistribution: string | number
  taxableAmount: string | number
  federalIncomeTaxWithheld: string | number
  RPlanType: PlanType1099
  // SSA fields
  // benefitsPaid: string | number
  // benefitsRepaid: string | number
  netBenefits: string | number
  // NEC fields
  nonemployeeCompensation: string | number
  necFederalWithholding: string | number
  necState?: State
  necStateWithholding: string | number
  // MISC fields
  rents: string | number
  royalties: string | number
  otherIncome: string | number
  miscFederalWithholding: string | number
  // G fields
  unemploymentCompensation: string | number
  stateLocalTaxRefund: string | number
  refundTaxYear: string | number
  gFederalWithholding: string | number
}

const blankUserInput: F1099UserInput = {
  formType: undefined,
  payer: '',
  interest: '',
  // B Fields
  shortTermProceeds: '',
  shortTermCostBasis: '',
  longTermProceeds: '',
  longTermCostBasis: '',
  // Div fields
  dividends: '',
  qualifiedDividends: '',
  totalCapitalGainsDistributions: '',
  // R fields
  grossDistribution: '',
  taxableAmount: '',
  federalIncomeTaxWithheld: '',
  RPlanType: PlanType1099.Pension,
  // SSA fields
  // benefitsPaid: '',
  // benefitsRepaid: '',
  netBenefits: '',
  // NEC fields
  nonemployeeCompensation: '',
  necFederalWithholding: '',
  necState: undefined,
  necStateWithholding: '',
  // MISC fields
  rents: '',
  royalties: '',
  otherIncome: '',
  miscFederalWithholding: '',
  // G fields
  unemploymentCompensation: '',
  stateLocalTaxRefund: '',
  refundTaxYear: '',
  gFederalWithholding: ''
}

const toUserInput = (f: Supported1099): F1099UserInput => ({
  ...blankUserInput,
  formType: f.type,
  payer: f.payer,
  personRole: f.personRole,

  ...(() => {
    switch (f.type) {
      case Income1099Type.INT: {
        return {
          interest: f.form.income
        }
      }
      case Income1099Type.B: {
        return f.form
      }
      case Income1099Type.DIV: {
        return f.form
      }
      case Income1099Type.R: {
        return f.form
      }
      case Income1099Type.SSA: {
        return f.form
      }
      case Income1099Type.NEC: {
        return {
          nonemployeeCompensation: f.form.nonemployeeCompensation,
          necFederalWithholding: f.form.federalIncomeTaxWithheld ?? '',
          necState: f.form.state,
          necStateWithholding: f.form.stateTaxWithheld ?? ''
        }
      }
      case Income1099Type.MISC: {
        return {
          rents: f.form.rents ?? '',
          royalties: f.form.royalties ?? '',
          otherIncome: f.form.otherIncome ?? '',
          miscFederalWithholding: f.form.federalIncomeTaxWithheld ?? ''
        }
      }
      case Income1099Type.G: {
        return {
          unemploymentCompensation: f.form.unemploymentCompensation ?? '',
          stateLocalTaxRefund: f.form.stateLocalTaxRefund ?? '',
          refundTaxYear: f.form.taxYear ?? '',
          gFederalWithholding: f.form.federalIncomeTaxWithheld ?? ''
        }
      }
    }
  })()
})

const toF1099 = (input: F1099UserInput): Supported1099 | undefined => {
  switch (input.formType) {
    case Income1099Type.INT: {
      return {
        payer: input.payer,
        personRole: input.personRole ?? PersonRole.PRIMARY,
        type: input.formType,
        form: {
          income: Number(input.interest)
        }
      }
    }
    case Income1099Type.B: {
      return {
        payer: input.payer,
        personRole: input.personRole ?? PersonRole.PRIMARY,
        type: input.formType,
        form: {
          shortTermCostBasis: Number(input.shortTermCostBasis),
          shortTermProceeds: Number(input.shortTermProceeds),
          longTermCostBasis: Number(input.longTermCostBasis),
          longTermProceeds: Number(input.longTermProceeds)
        }
      }
    }
    case Income1099Type.DIV: {
      return {
        payer: input.payer,
        personRole: input.personRole ?? PersonRole.PRIMARY,
        type: input.formType,
        form: {
          dividends: Number(input.dividends),
          qualifiedDividends: Number(input.qualifiedDividends),
          totalCapitalGainsDistributions: Number(
            input.totalCapitalGainsDistributions
          )
        }
      }
    }
    case Income1099Type.R: {
      return {
        payer: input.payer,
        personRole: input.personRole ?? PersonRole.PRIMARY,
        type: input.formType,
        form: {
          grossDistribution: Number(input.grossDistribution),
          taxableAmount: Number(input.taxableAmount),
          federalIncomeTaxWithheld: Number(input.federalIncomeTaxWithheld),
          planType: PlanType1099.Pension
        }
      }
    }
    case Income1099Type.SSA: {
      return {
        payer: input.payer,
        personRole: input.personRole ?? PersonRole.PRIMARY,
        type: input.formType,
        form: {
          // benefitsPaid: Number(input.benefitsPaid),
          // benefitsRepaid: Number(input.benefitsRepaid),
          netBenefits: Number(input.netBenefits),
          federalIncomeTaxWithheld: Number(input.federalIncomeTaxWithheld)
        }
      }
    }
    case Income1099Type.NEC: {
      return {
        payer: input.payer,
        personRole: input.personRole ?? PersonRole.PRIMARY,
        type: input.formType,
        form: {
          nonemployeeCompensation: Number(input.nonemployeeCompensation),
          federalIncomeTaxWithheld:
            Number(input.necFederalWithholding) || undefined,
          state: input.necState,
          stateTaxWithheld: Number(input.necStateWithholding) || undefined
        }
      }
    }
    case Income1099Type.MISC: {
      return {
        payer: input.payer,
        personRole: input.personRole ?? PersonRole.PRIMARY,
        type: input.formType,
        form: {
          rents: Number(input.rents) || undefined,
          royalties: Number(input.royalties) || undefined,
          otherIncome: Number(input.otherIncome) || undefined,
          federalIncomeTaxWithheld:
            Number(input.miscFederalWithholding) || undefined
        }
      }
    }
    case Income1099Type.G: {
      return {
        payer: input.payer,
        personRole: input.personRole ?? PersonRole.PRIMARY,
        type: input.formType,
        form: {
          unemploymentCompensation:
            Number(input.unemploymentCompensation) || undefined,
          stateLocalTaxRefund: Number(input.stateLocalTaxRefund) || undefined,
          taxYear: Number(input.refundTaxYear) || undefined,
          federalIncomeTaxWithheld:
            Number(input.gFederalWithholding) || undefined
        }
      }
    }
  }
}

export default function F1099Info(): ReactElement {
  const f1099s = useSelector((state: TaxesState) => state.information.f1099s)

  const defaultValues = blankUserInput

  const methods = useForm<F1099UserInput>({ defaultValues })
  const { handleSubmit, watch } = methods
  const selectedType: Income1099Type | undefined = watch('formType')

  const dispatch = useDispatch()

  const { onAdvance, navButtons } = usePager()

  const onSubmitAdd = (formData: F1099UserInput): void => {
    const payload = toF1099(formData)
    if (payload !== undefined) {
      dispatch(add1099(payload))
    }
  }

  const onSubmitEdit =
    (index: number) =>
    (formData: F1099UserInput): void => {
      const payload = toF1099(formData)
      if (payload !== undefined) {
        dispatch(edit1099({ value: payload, index }))
      }
    }

  const people: Person[] = useSelector((state: TaxesState) => [
    state.information.taxPayer.primaryPerson,
    state.information.taxPayer.spouse
  ])
    .filter((p) => p !== undefined)
    .map((p) => p as Person)

  const intFields = (
    <Grid container spacing={2}>
      <LabeledInput
        label={
          <>
            <strong>Box 1</strong> - Interest Income
          </>
        }
        patternConfig={Patterns.currency}
        name="interest"
      />
    </Grid>
  )

  const bFields = (
    <>
      <h3>Long Term Covered Transactions</h3>
      <Grid container spacing={2}>
        <LabeledInput
          label="Proceeds"
          patternConfig={Patterns.currency}
          name="longTermProceeds"
          sizes={{ xs: 6 }}
        />
        <LabeledInput
          label="Cost basis"
          patternConfig={Patterns.currency}
          name="longTermCostBasis"
          sizes={{ xs: 6 }}
        />
      </Grid>
      <h3>Short Term Covered Transactions</h3>
      <Grid container spacing={2}>
        <LabeledInput
          label="Proceeds"
          patternConfig={Patterns.currency}
          name="shortTermProceeds"
          sizes={{ xs: 6 }}
        />
        <LabeledInput
          label="Cost basis"
          patternConfig={Patterns.currency}
          name="shortTermCostBasis"
          sizes={{ xs: 6 }}
        />
      </Grid>
    </>
  )

  const divFields = (
    <Grid container spacing={2}>
      <LabeledInput
        label={boxLabel('1a', 'Total Dividends')}
        patternConfig={Patterns.currency}
        name="dividends"
      />
      <LabeledInput
        label={boxLabel('1b', 'Qualified Dividends')}
        patternConfig={Patterns.currency}
        name="qualifiedDividends"
      />
      <LabeledInput
        label={boxLabel('2a', 'Total capital gains distributions')}
        patternConfig={Patterns.currency}
        name="totalCapitalGainsDistributions"
      />
    </Grid>
  )

  const rFields = (
    <Grid container spacing={2}>
      <Alert severity="warning">
        Use this form only for 1099-R forms related to your 401(k) or other
        retirement plans. If you have 1099-R forms from IRA accounts please see
        the <Link to="/savingsaccounts/ira">IRA page</Link>
      </Alert>
      <LabeledInput
        label={boxLabel('1', 'Gross Distribution')}
        patternConfig={Patterns.currency}
        name="grossDistribution"
      />
      <LabeledInput
        label={boxLabel('2a', 'Taxable Amount')}
        patternConfig={Patterns.currency}
        name="taxableAmount"
      />
      <LabeledInput
        label={boxLabel('4', 'Federal Income Tax Withheld')}
        patternConfig={Patterns.currency}
        name="federalIncomeTaxWithheld"
      />
      <GenericLabeledDropdown<PlanType1099, F1099UserInput>
        label="Type of 1099-R"
        dropDownData={Object.values(PlanType1099)}
        valueMapping={(x) => x}
        keyMapping={(_, i) => i}
        textMapping={(status) => PlanType1099Texts[status]}
        name="RPlanType"
      />
    </Grid>
  )

  const ssaFields = (
    <Grid container spacing={2}>
      {/* <LabeledInput
        label="Box 3 - Benefits Paid"
        patternConfig={Patterns.currency}
        name="benefitsPaid"
      />
      <LabeledInput
        label="Box 4 - Benefits Repaid"
        patternConfig={Patterns.currency}
        name="benefitsRepaid"
      /> */}
      <LabeledInput
        label={
          <>
            <strong>Box 5</strong> - Net Benefits
          </>
        }
        patternConfig={Patterns.currency}
        name="netBenefits"
      />
      <LabeledInput
        label={
          <>
            <strong>Box 6</strong> - Voluntary Federal Income Tax Withheld
          </>
        }
        patternConfig={Patterns.currency}
        name="federalIncomeTaxWithheld"
      />
    </Grid>
  )

  const necFields = (
    <Grid container spacing={2}>
      <Alert severity="info">
        Form 1099-NEC reports nonemployee compensation (freelance, gig economy,
        independent contractor income). This income is subject to
        self-employment tax and should be reported on Schedule C.
      </Alert>
      <LabeledInput
        label={boxLabel('1', 'Nonemployee Compensation')}
        patternConfig={Patterns.currency}
        name="nonemployeeCompensation"
      />
      <LabeledInput
        label={boxLabel('4', 'Federal Income Tax Withheld')}
        patternConfig={Patterns.currency}
        name="necFederalWithholding"
      />
      <LabeledInput
        label={boxLabel('5', 'State Tax Withheld')}
        patternConfig={Patterns.currency}
        name="necStateWithholding"
      />
    </Grid>
  )

  const miscFields = (
    <Grid container spacing={2}>
      <Alert severity="info">
        Form 1099-MISC reports miscellaneous income including rents, royalties,
        prizes, awards, and other income not reported elsewhere.
      </Alert>
      <LabeledInput
        label={boxLabel('1', 'Rents')}
        patternConfig={Patterns.currency}
        name="rents"
      />
      <LabeledInput
        label={boxLabel('2', 'Royalties')}
        patternConfig={Patterns.currency}
        name="royalties"
      />
      <LabeledInput
        label={boxLabel('3', 'Other Income')}
        patternConfig={Patterns.currency}
        name="otherIncome"
      />
      <LabeledInput
        label={boxLabel('4', 'Federal Income Tax Withheld')}
        patternConfig={Patterns.currency}
        name="miscFederalWithholding"
      />
    </Grid>
  )

  const gFields = (
    <Grid container spacing={2}>
      <Alert severity="info">
        Form 1099-G reports government payments including unemployment
        compensation and state/local income tax refunds.
      </Alert>
      <LabeledInput
        label={boxLabel('1', 'Unemployment Compensation')}
        patternConfig={Patterns.currency}
        name="unemploymentCompensation"
      />
      <LabeledInput
        label={boxLabel('2', 'State or Local Income Tax Refunds')}
        patternConfig={Patterns.currency}
        name="stateLocalTaxRefund"
      />
      <LabeledInput
        label={boxLabel('3', 'Tax Year of Refund')}
        patternConfig={Patterns.year}
        name="refundTaxYear"
      />
      <LabeledInput
        label={boxLabel('4', 'Federal Income Tax Withheld')}
        patternConfig={Patterns.currency}
        name="gFederalWithholding"
      />
    </Grid>
  )

  const specificFields: { [key in Income1099Type]: ReactElement } = {
    [Income1099Type.INT]: intFields,
    [Income1099Type.B]: bFields,
    [Income1099Type.DIV]: divFields,
    [Income1099Type.R]: rFields,
    [Income1099Type.SSA]: ssaFields,
    [Income1099Type.NEC]: necFields,
    [Income1099Type.MISC]: miscFields,
    [Income1099Type.G]: gFields
  }

  const titles: { [key in Income1099Type]: string } = {
    [Income1099Type.INT]: '1099-INT',
    [Income1099Type.B]: '1099-B',
    [Income1099Type.DIV]: '1099-DIV',
    [Income1099Type.R]: '1099-R',
    [Income1099Type.SSA]: 'SSA-1099',
    [Income1099Type.NEC]: '1099-NEC',
    [Income1099Type.MISC]: '1099-MISC',
    [Income1099Type.G]: '1099-G'
  }

  const form: ReactElement | undefined = (
    <FormListContainer
      defaultValues={defaultValues}
      onSubmitAdd={onSubmitAdd}
      onSubmitEdit={onSubmitEdit}
      items={f1099s.map((a) => toUserInput(a))}
      removeItem={(i) => dispatch(remove1099(i))}
      primary={(f) => f.payer}
      secondary={(f) => {
        const form = toF1099(f)
        if (form !== undefined) {
          return showIncome(form)
        }
        return ''
      }}
      icon={(f) => (
        <Icon
          style={{ lineHeight: 1 }}
          title={f.formType !== undefined ? titles[f.formType] : undefined}
        >
          {f.formType}
        </Icon>
      )}
    >
      <p>Input data from 1099</p>
      <Grid container spacing={2}>
        <GenericLabeledDropdown
          autofocus={true}
          dropDownData={Object.values(Income1099Type)}
          label="Form Type"
          valueMapping={(v: Income1099Type) => v}
          name="formType"
          keyMapping={(_, i: number) => i}
          textMapping={(name: string) => `1099-${name}`}
        />

        <LabeledInput
          label="Enter name of bank, broker firm, or other payer"
          required={true}
          name="payer"
        />
      </Grid>
      {selectedType !== undefined ? specificFields[selectedType] : undefined}
      <Grid container spacing={2}>
        <GenericLabeledDropdown
          dropDownData={people}
          label="Recipient"
          valueMapping={(p: Person, i: number) =>
            [PersonRole.PRIMARY, PersonRole.SPOUSE][i]
          }
          name="personRole"
          keyMapping={(p: Person, i: number) => i}
          textMapping={(p: Person) =>
            `${p.firstName} ${p.lastName} (${formatSSID(p.ssid)})`
          }
        />
      </Grid>
    </FormListContainer>
  )

  return (
    <FormProvider {...methods}>
      <form
        tabIndex={-1}
        onSubmit={intentionallyFloat(handleSubmit(onAdvance))}
      >
        <Helmet>
          <title>1099 Information | Income | UsTaxes.org</title>
        </Helmet>
        <h2>1099 Information</h2>
        {form}
        {navButtons}
      </form>
    </FormProvider>
  )
}
