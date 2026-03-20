#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const cwd = new URL('..', import.meta.url)

const testInvocations = [
  { file: 'test/ats/fullScenarioMatrix.acceptance.test.ts' },
  { file: 'test/ats/idempotency.test.ts' },
  { file: 'test/ats/scenario1.acceptance.test.ts' },
  { file: 'test/ats/scenario1.reject-missing-tin.test.ts' },
  { file: 'test/service/apiService.idempotency-conflict.test.ts' },
  { file: 'test/service/apiService.lifecycle.test.ts' },
  { file: 'test/service/apiService.retry.test.ts' },
  { file: 'test/service/apiService.validation.test.ts' },
  { file: 'test/service/businessEntityCalc.test.ts' },
  { file: 'test/service/businessParityFixtures.test.ts' },
  { file: 'test/service/mefComplianceService.test.ts' },
  { file: 'test/service/orchestration.ats-expected-mismatch.test.ts' },
  { file: 'test/service/orchestration.behavior.test.ts' },
  { file: 'test/service/orchestration.missing-payload.test.ts' },
  { file: 'test/service/orchestration.missing-return.test.ts' },
  { file: 'test/service/taxCalculationService.businessEntities.test.ts' },
  { file: 'test/service/taxCalculationService.excel1040Parity.test.ts' },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: 'maps filing status correctly'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: 'maps W-2 records to IncomeW2'
  },
  { file: 'test/service/taxCalculationService.test.ts', pattern: 'maps dependents' },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: 'maps spouse for MFJ'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: 'maps 1099-INT records'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern:
      'maps workbook-grade 1099-INT and 1099-DIV tax-exempt fields into Form 1040 line 2a'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: 'maps richer 1099-DIV and 1099-B detail for workbook parity'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern:
      'maps workbook-style unemployment, SSA, student loan, and retirement facts'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern:
      'maps Schedule 8812 earned-income adjustments and other withholding credits into workbook-sensitive 1040 fields'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern:
      'maps Form 8879 signature facts into the e-file attachment with current-return totals'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: 'maps third-party designee facts into the shared e-file data model'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern:
      'maps casualty, line 6 other taxes, and miscellaneous deduction rollups into Schedule A-sensitive fields'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: 'computes tax for a single filer with $50K W-2 income'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: 'computes tax for MFJ with dependents'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: 'returns zero tax for zero income'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: 'handles 1099-NEC as f1099 entry'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: 'applies workbook-style unemployment and student-loan adjustment flow'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern:
      'includes retirement distributions and social security in the workbook-style income flow'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern:
      'applies workbook-style Forms 4137, 8919, and 8801 in the combined tax flow'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern:
      'carries W-2 box 12 A/B/M/N amounts into Schedule 2 line 13 through the backend adapter'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: 'computes state tax for CA filer with W-2 income'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: 'computes state tax for IL filer'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: 'uses 1099-B basis detail so only net gains reach AGI'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern:
      'normalizes workbook-style Schedule A aliases into canonical itemized deductions'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern:
      'switches to a nonresident calculation branch when 1040-NR facts are present'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: '§2.1 standard deduction: single $15,750 applied to taxable income'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: '§2.3 CTC: MFJ with qualifying child reduces tax by at least $2,200'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern:
      '§2.4 SALT cap: itemized deductions with $50k state taxes capped at $40,000'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: '§2.5 QBI: self-employment income produces ~20% QBI deduction'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern:
      'keeps QBI deduction-side inputs separate from worksheet entity rows'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern:
      'maps page-2 Schedule E K-1 facts into partnership records for the form engine'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern:
      'maps passive-loss carryovers and Schedule E page-2 eligibility facts'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern:
      'merges Schedule NEC and 1099 FDAP sources into the nonresident return surface'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern:
      '§2.6 NIIT: investment income above $200k threshold attracts 3.8% tax'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: 'computes C-Corp tax at 21% flat rate'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: 'computes S-Corp pass-through allocations'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: 'computes Partnership allocations'
  },
  {
    file: 'test/service/taxCalculationService.test.ts',
    pattern: 'computes Trust/Estate tax with compressed brackets'
  },
  { file: 'test/unit/ackEngine.test.ts' },
  { file: 'test/unit/factGraphValidation.test.ts' },
  { file: 'test/unit/hash.test.ts' },
  { file: 'test/utils/appAuth.test.ts' },
  { file: 'test/utils/oidc.test.ts' },
  { file: 'test/worker/internalAuth.test.ts' },
  { file: 'test/worker/queueHandler.test.ts' }
]

for (const invocation of testInvocations) {
  const args = ['vitest', 'run', invocation.file]
  if (invocation.pattern) {
    args.push('-t', invocation.pattern)
  }

  execFileSync('npx', args, {
    cwd,
    stdio: 'inherit',
    env: process.env
  })
}
