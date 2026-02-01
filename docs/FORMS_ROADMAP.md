# UsTaxes Forms Roadmap - Future Enhancements

This document outlines potential future enhancements and forms that are not yet implemented.

---

## Recently Implemented (January 2025)

### Estate, Gift, and Fiduciary Forms

| Form      | Name                        | Status        | Notes                            |
| --------- | --------------------------- | ------------- | -------------------------------- |
| Form 706  | Estate Tax Return           | ✓ Implemented | Estates over exemption threshold |
| Form 709  | Gift Tax Return             | ✓ Implemented | Gifts over annual exclusion      |
| Form 1041 | Fiduciary Income Tax Return | ✓ Implemented | Estates and trusts               |

### Exempt Organization Forms

| Form        | Name                       | Status        | Notes                |
| ----------- | -------------------------- | ------------- | -------------------- |
| Form 990    | Exempt Organization Return | ✓ Implemented | 501(c) organizations |
| Form 990-EZ | Short Form                 | ✓ Implemented | Small exempt orgs    |
| Form 990-PF | Private Foundation         | ✓ Implemented | Foundation-specific  |
| Form 990-T  | Unrelated Business Income  | ✓ Implemented | UBTI for nonprofits  |

### International Forms

| Form        | Name                           | Status        | Notes                        |
| ----------- | ------------------------------ | ------------- | ---------------------------- |
| FinCEN 114  | FBAR                           | ✓ Implemented | Foreign bank accounts > $10k |
| Form 3520   | Foreign Trusts and Gifts       | ✓ Implemented | Large foreign gifts          |
| Form 3520-A | Foreign Trust Annual Return    | ✓ Implemented | US owner of foreign trust    |
| Form 8621   | PFIC Annual Information        | ✓ Implemented | Passive foreign investment   |
| Form 8858   | Foreign Disregarded Entity     | ✓ Implemented | Single-member foreign LLC    |
| Form 926    | Return of Transferred Property | ✓ Implemented | Transfers to foreign corps   |

---

## Currently Not Implemented

### Exempt Organizations - Additional

| Form                | Name                | Priority | Notes                    |
| ------------------- | ------------------- | -------- | ------------------------ |
| Form 990-N          | e-Postcard          | Low      | Very small orgs (< $50k) |
| Schedule K-1 (1041) | Beneficiary's Share | Medium   | Trust distributions      |

### Employment Tax - Amended Returns

| Form       | Name                        | Priority | Notes       |
| ---------- | --------------------------- | -------- | ----------- |
| Form 941-X | Amended Quarterly Return    | Medium   | Corrections |
| Form 943-X | Amended Agricultural Return | Low      | Corrections |
| Form 944-X | Amended Annual Return       | Low      | Corrections |
| Form 945-X | Amended Withholding Return  | Low      | Corrections |

---

## Enhancement Opportunities

### PDF Field Mapping

| Item             | Current State       | Enhancement                     |
| ---------------- | ------------------- | ------------------------------- |
| Field Validation | Basic type checking | Add range/format validation     |
| Field Mapping    | Manual alignment    | Auto-generate from PDF analysis |
| Multi-page Forms | Supported           | Improve copy() mechanism        |

### Calculation Improvements

| Area                      | Current State | Enhancement                        |
| ------------------------- | ------------- | ---------------------------------- |
| AMT Calculations          | Basic         | Add AMTI adjustments for all items |
| Capital Loss Carryforward | Basic         | Multi-year tracking                |
| Passive Activity Loss     | Form exists   | Full limitation calculations       |
| Net Operating Loss        | Not tracked   | Add NOL carryforward/carryback     |
| At-Risk Basis             | Basic         | Full partner basis tracking        |
| 199A QBI                  | Basic         | Add W-2 wage/UBIA limitations      |

### State Tax Integration

| State         | Current State       | Priority                |
| ------------- | ------------------- | ----------------------- |
| All 50 states | Y2020-2024 partial  | Update to Y2025         |
| State credits | Limited             | Add major state credits |
| Multi-state   | Basic apportionment | Improve allocation      |

### UI/UX Improvements

| Area           | Current State | Enhancement            |
| -------------- | ------------- | ---------------------- |
| Form Wizard    | Basic linear  | Conditional branching  |
| Data Import    | Manual entry  | CSV/PDF import         |
| Error Messages | Basic         | Context-sensitive help |
| Tax Estimates  | Not available | Real-time calculation  |

---

## Data Model Enhancements Needed

### Missing Data Fields

```typescript
// Suggested additions to Information interface

// Net Operating Loss tracking
nolCarryforward?: number
nolCarryback?: number

// Capital Loss Carryforward
capitalLossCarryforward?: {
  shortTerm: number
  longTerm: number
}

// Passive Activity Loss Carryforward
passiveLossCarryforward?: {
  activityId: string
  suspendedLoss: number
}[]

// At-Risk Basis Tracking
atRiskBasis?: {
  activityId: string
  basis: number
  atRiskAmount: number
}[]

// Section 1231 Loss Lookback (5 years)
section1231Losses?: {
  year: number
  amount: number
}[]

// QBI Component Tracking
qbiComponents?: {
  businessId: string
  qualifiedBusinessIncome: number
  w2Wages: number
  ubiaOfQualifiedProperty: number
}[]
```

---

## Testing Improvements

### Current Coverage

| Area              | Coverage | Target |
| ----------------- | -------- | ------ |
| Unit Tests        | ~60%     | 90%    |
| Integration Tests | ~40%     | 80%    |
| E2E Tests         | ~20%     | 50%    |

### Recommended Test Scenarios

1. **Edge Cases**

   - Zero income with credits
   - Maximum income phase-outs
   - Multi-state apportionment
   - AMT crossover points

2. **Form Combinations**

   - Schedule C + Schedule E + K-1s
   - Foreign income + Foreign tax credit
   - Rental losses + passive activity limits

3. **Year-Over-Year**
   - Carryforward amounts
   - Prior year references
   - Tax law changes

---

## Performance Optimizations

| Area               | Current           | Improvement           |
| ------------------ | ----------------- | --------------------- |
| Form instantiation | All forms created | Lazy instantiation    |
| PDF generation     | Sequential        | Parallel processing   |
| State calculations | After federal     | Parallel with federal |

---

## Documentation Needs

| Document                 | Status     | Priority |
| ------------------------ | ---------- | -------- |
| FORMS_Y2025.md           | ✓ Complete | -        |
| API Reference            | Missing    | High     |
| Form Field Mapping Guide | Missing    | Medium   |
| State Tax Guide          | Outdated   | Medium   |
| Testing Guide            | Missing    | High     |

---

## Contribution Opportunities

### Good First Issues

1. Add missing `isNeeded()` logic for specialized forms
2. Improve field mapping for existing forms
3. Add unit tests for form calculations
4. Update state forms to Y2025

### Medium Complexity

1. Implement carryforward tracking
2. Add multi-state apportionment
3. Improve passive activity calculations
4. Add QBI W-2 wage limitations

### Advanced

1. K-1 (1041) generation for trusts/estates
2. Form 990-N e-Postcard
3. Amended employment tax returns
4. Real-time tax estimation

---

## Timeline Recommendations

### Q1 2025

- [x] Complete PDF template updates for Y2025
- [x] Estate, Gift, and Fiduciary forms
- [x] Exempt Organization forms
- [x] Advanced International forms (FBAR, PFIC, etc.)
- [ ] State form updates
- [ ] Core calculation testing

### Q2 2025

- [ ] Carryforward tracking
- [ ] Enhanced QBI calculations
- [ ] Performance optimizations
- [ ] K-1 (1041) generation

### Q3 2025

- [ ] Multi-year support
- [ ] Amended employment returns
- [ ] Enhanced state support

### Q4 2025

- [ ] Y2026 preparation
- [ ] Full test coverage
- [ ] Documentation completion

---

## Form Count Summary

| Category                | Implemented | Pending |
| ----------------------- | ----------- | ------- |
| Core 1040 & Schedules   | 18          | 0       |
| Credits (Refundable)    | 4           | 0       |
| Credits (Nonrefundable) | 9           | 0       |
| Business Credits        | 19          | 0       |
| Income/Deduction Forms  | 8           | 0       |
| Business Forms          | 13          | 0       |
| Retirement/Savings      | 8           | 0       |
| Foreign/International   | 16          | 0       |
| Estate/Gift/Fiduciary   | 3           | 0       |
| Exempt Organizations    | 4           | 1       |
| Taxes/Penalties         | 10          | 0       |
| Extensions/Payments     | 5           | 0       |
| Collection/Procedure    | 7           | 0       |
| Employment/Payroll      | 6           | 4       |
| Excise Taxes            | 3           | 0       |
| OBBBA 2025 New          | 3           | 0       |
| **Total**               | **144**     | **5**   |

---

_Last Updated: January 2025_
