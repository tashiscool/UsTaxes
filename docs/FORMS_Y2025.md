# UsTaxes Form Implementation Status - Tax Year 2025

This document provides a comprehensive overview of all IRS forms implemented for tax year 2025.

## Summary

| Category                   | Count | Status   |
| -------------------------- | ----- | -------- |
| **Total Form Files**       | 151   | Complete |
| **Integrated in F1040**    | 146   | Complete |
| **TypeScript Compilation** | ✓     | Passing  |

---

## Individual Tax Forms (Form 1040 & Schedules)

### Core 1040 Forms

| Form     | Name                                | Status        | Notes                      |
| -------- | ----------------------------------- | ------------- | -------------------------- |
| F1040    | U.S. Individual Income Tax Return   | ✓ Implemented | Main orchestrating form    |
| F1040-SR | U.S. Tax Return for Seniors         | ✓ Implemented | Age 65+ variant            |
| F1040-NR | Nonresident Alien Income Tax Return | ✓ Implemented | Non-resident variant       |
| F1040-SS | Self-Employment Tax (Territories)   | ✓ Implemented | PR, VI, Guam, AS, CNMI     |
| F1040-V  | Payment Voucher                     | ✓ Implemented | Auto-attached when tax due |

### Schedules

| Schedule      | Name                               | Status        | Notes                |
| ------------- | ---------------------------------- | ------------- | -------------------- |
| Schedule 1    | Additional Income and Adjustments  | ✓ Implemented |                      |
| Schedule 1-A  | Additional Deductions (OBBBA 2025) | ✓ Implemented | New for 2025         |
| Schedule 2    | Additional Taxes                   | ✓ Implemented |                      |
| Schedule 3    | Additional Credits and Payments    | ✓ Implemented |                      |
| Schedule A    | Itemized Deductions                | ✓ Implemented |                      |
| Schedule B    | Interest and Ordinary Dividends    | ✓ Implemented |                      |
| Schedule C    | Profit or Loss from Business       | ✓ Implemented | Self-employment      |
| Schedule D    | Capital Gains and Losses           | ✓ Implemented |                      |
| Schedule E    | Supplemental Income and Loss       | ✓ Implemented | Rental, royalty, K-1 |
| Schedule EIC  | Earned Income Credit               | ✓ Implemented |                      |
| Schedule F    | Profit or Loss from Farming        | ✓ Implemented |                      |
| Schedule H    | Household Employment Taxes         | ✓ Implemented |                      |
| Schedule J    | Income Averaging for Farmers       | ✓ Implemented |                      |
| Schedule K-1  | Partner's Share of Income          | ✓ Implemented | 1065 flowthrough     |
| Schedule R    | Credit for Elderly/Disabled        | ✓ Implemented |                      |
| Schedule SE   | Self-Employment Tax                | ✓ Implemented |                      |
| Schedule 8812 | Child Tax Credit                   | ✓ Implemented |                      |

---

## Credits

### Refundable Credits

| Form          | Name                     | Status        | Notes                  |
| ------------- | ------------------------ | ------------- | ---------------------- |
| Schedule 8812 | Child Tax Credit / ACTC  | ✓ Implemented |                        |
| Schedule EIC  | Earned Income Credit     | ✓ Implemented |                        |
| F8863         | Education Credits (AOTC) | ✓ Implemented |                        |
| F8962         | Premium Tax Credit (ACA) | ✓ Implemented | Healthcare marketplace |

### Nonrefundable Credits

| Form       | Name                             | Status        | Notes                    |
| ---------- | -------------------------------- | ------------- | ------------------------ |
| F2441      | Child and Dependent Care Credit  | ✓ Implemented |                          |
| F5695      | Residential Energy Credits       | ✓ Implemented | Solar, energy efficiency |
| F8839      | Adoption Credit                  | ✓ Implemented |                          |
| F8880      | Saver's Credit                   | ✓ Implemented | Retirement contributions |
| F8910      | Alternative Motor Vehicle Credit | ✓ Implemented | Fuel cell vehicles       |
| F8936      | Clean Vehicle Credit             | ✓ Implemented | EV credit                |
| F1116      | Foreign Tax Credit               | ✓ Implemented |                          |
| F8801      | Prior Year AMT Credit            | ✓ Implemented |                          |
| Schedule R | Credit for Elderly/Disabled      | ✓ Implemented |                          |

### Business Credits (General Business Credit Components)

| Form  | Name                                      | Status        | Notes                           |
| ----- | ----------------------------------------- | ------------- | ------------------------------- |
| F3800 | General Business Credit                   | ✓ Implemented | Aggregates all business credits |
| F3468 | Investment Credit                         | ✓ Implemented | Solar, renewable energy         |
| F5884 | Work Opportunity Credit                   | ✓ Implemented | Hiring incentives               |
| F6765 | Research Credit                           | ✓ Implemented | R&D expenses                    |
| F8586 | Low-Income Housing Credit                 | ✓ Implemented |                                 |
| F8820 | Orphan Drug Credit                        | ✓ Implemented |                                 |
| F8826 | Disabled Access Credit                    | ✓ Implemented |                                 |
| F8835 | Renewable Electricity Credit              | ✓ Implemented |                                 |
| F8844 | Empowerment Zone Employment Credit        | ✓ Implemented |                                 |
| F8845 | Indian Employment Credit                  | ✓ Implemented |                                 |
| F8846 | Employer-Provided Childcare Credit        | ✓ Implemented |                                 |
| F8864 | Biodiesel and Renewable Diesel Credit     | ✓ Implemented |                                 |
| F8874 | New Markets Credit                        | ✓ Implemented |                                 |
| F8881 | Small Employer Pension Startup Credit     | ✓ Implemented |                                 |
| F8882 | Credit for Employer Social Security       | ✓ Implemented |                                 |
| F8932 | Employer Differential Wage Payment Credit | ✓ Implemented |                                 |
| F8933 | Carbon Oxide Sequestration Credit         | ✓ Implemented |                                 |
| F8941 | Small Employer Health Insurance Credit    | ✓ Implemented |                                 |
| F8994 | Paid Family and Medical Leave Credit      | ✓ Implemented |                                 |
| F4136 | Credit for Federal Tax Paid on Fuels      | ✓ Implemented |                                 |

---

## Income and Deductions

### Income Forms

| Form         | Name                                  | Status        | Notes                 |
| ------------ | ------------------------------------- | ------------- | --------------------- |
| Form 1099    | Various Information Returns           | ✓ Implemented | INT, DIV, B, R, etc.  |
| Form W-2/W-3 | Wage and Tax Statement                | ✓ Implemented |                       |
| F2439        | Undistributed Long-Term Capital Gains | ✓ Implemented |                       |
| F2555        | Foreign Earned Income Exclusion       | ✓ Implemented | Up to $120k exclusion |
| F4563        | Exclusion of Income (American Samoa)  | ✓ Implemented |                       |
| F8814        | Child's Interest and Dividends        | ✓ Implemented | Kiddie tax election   |

### Deduction Forms

| Form       | Name                             | Status        | Notes         |
| ---------- | -------------------------------- | ------------- | ------------- |
| Schedule A | Itemized Deductions              | ✓ Implemented |               |
| F4952      | Investment Interest Expense      | ✓ Implemented |               |
| F8283      | Noncash Charitable Contributions | ✓ Implemented | Over $500     |
| F8829      | Business Use of Home             | ✓ Implemented | Home office   |
| F3903      | Moving Expenses                  | ✓ Implemented | Military only |

---

## Business Forms

### Self-Employment

| Form        | Name                                | Status        | Notes       |
| ----------- | ----------------------------------- | ------------- | ----------- |
| Schedule C  | Profit or Loss from Business        | ✓ Implemented |             |
| Schedule SE | Self-Employment Tax                 | ✓ Implemented |             |
| F4562       | Depreciation and Amortization       | ✓ Implemented | Section 179 |
| F4797       | Sale of Business Property           | ✓ Implemented |             |
| F6198       | At-Risk Limitations                 | ✓ Implemented |             |
| F8582       | Passive Activity Loss Limitations   | ✓ Implemented |             |
| F8582-CR    | Passive Activity Credit Limitations | ✓ Implemented |             |

### Entity Forms (Reference/Informational)

| Form    | Name                           | Status        | Notes          |
| ------- | ------------------------------ | ------------- | -------------- |
| F1065   | Partnership Return             | ✓ Implemented | K-1 generation |
| F1120   | C-Corporation Return           | ✓ Implemented |                |
| F1120-S | S-Corporation Return           | ✓ Implemented | K-1 generation |
| F2553   | S-Corporation Election         | ✓ Implemented |                |
| F8832   | Entity Classification Election | ✓ Implemented |                |

### Transactions

| Form  | Name                    | Status        | Notes          |
| ----- | ----------------------- | ------------- | -------------- |
| F6252 | Installment Sales       | ✓ Implemented |                |
| F8824 | Like-Kind Exchanges     | ✓ Implemented | 1031 exchanges |
| F4684 | Casualties and Thefts   | ✓ Implemented |                |
| F8949 | Sales of Capital Assets | ✓ Implemented |                |

---

## Retirement and Savings

| Form     | Name                                | Status        | Notes                      |
| -------- | ----------------------------------- | ------------- | -------------------------- |
| F5329    | Additional Taxes on Qualified Plans | ✓ Implemented | Early withdrawal penalties |
| F8606    | Nondeductible IRAs                  | ✓ Implemented | Basis tracking             |
| F8889    | Health Savings Accounts             | ✓ Implemented |                            |
| F8853    | Archer MSAs and Long-Term Care      | ✓ Implemented |                            |
| F4972    | Tax on Lump-Sum Distributions       | ✓ Implemented |                            |
| F5330    | Excise Taxes on Retirement Plans    | ✓ Implemented |                            |
| F5500    | Employee Benefit Plan Return        | ✓ Implemented |                            |
| F5500-EZ | One-Participant Plan Return         | ✓ Implemented | Solo 401(k)                |

---

## Foreign/International

| Form       | Name                             | Status        | Notes                      |
| ---------- | -------------------------------- | ------------- | -------------------------- |
| F1116      | Foreign Tax Credit               | ✓ Implemented |                            |
| F2555      | Foreign Earned Income Exclusion  | ✓ Implemented |                            |
| F3520      | Foreign Trusts and Gifts         | ✓ Implemented | Foreign gift reporting     |
| F3520-A    | Foreign Trust Annual Return      | ✓ Implemented | Trustee filing             |
| F5471      | Foreign Corporation Information  | ✓ Implemented | CFC reporting              |
| F5472      | Foreign-Owned U.S. Corporation   | ✓ Implemented |                            |
| F8621      | PFIC Annual Information          | ✓ Implemented | Passive foreign investment |
| F8858      | Foreign Disregarded Entity       | ✓ Implemented | FDE/FB reporting           |
| F8865      | Foreign Partnership Return       | ✓ Implemented |                            |
| F926       | Return of Transferred Property   | ✓ Implemented | Property to foreign corp   |
| F8938      | FATCA Foreign Financial Assets   | ✓ Implemented |                            |
| F8966      | FATCA Certification              | ✓ Implemented |                            |
| FinCEN 114 | FBAR Report                      | ✓ Implemented | Foreign bank accounts      |
| F8833      | Treaty-Based Return Position     | ✓ Implemented |                            |
| F8840      | Closer Connection Exception      | ✓ Implemented |                            |
| F8843      | Statement for Exempt Individuals | ✓ Implemented |                            |

---

## Taxes and Penalties

| Form    | Name                                 | Status        | Notes          |
| ------- | ------------------------------------ | ------------- | -------------- |
| F6251   | Alternative Minimum Tax              | ✓ Implemented |                |
| F8959   | Additional Medicare Tax              | ✓ Implemented | 0.9% surcharge |
| F8960   | Net Investment Income Tax            | ✓ Implemented | 3.8% NIIT      |
| F8615   | Kiddie Tax                           | ✓ Implemented |                |
| F2210   | Underpayment of Estimated Tax        | ✓ Implemented |                |
| F4137   | SS/Medicare Tax on Unreported Tips   | ✓ Implemented |                |
| F8919   | Uncollected SS/Medicare Tax on Wages | ✓ Implemented |                |
| F4255   | Recapture of Investment Credit       | ✓ Implemented |                |
| F8915-F | Qualified Disaster Distributions     | ✓ Implemented |                |

---

## Extensions and Payments

| Form  | Name                          | Status        | Notes             |
| ----- | ----------------------------- | ------------- | ----------------- |
| F4868 | Extension of Time to File     | ✓ Implemented | 6-month extension |
| F2350 | Extension for Citizens Abroad | ✓ Implemented | Beyond Oct 15     |
| F7004 | Business Extension            | ✓ Implemented |                   |
| F8809 | Information Return Extension  | ✓ Implemented | W-2, 1099 filing  |
| F8868 | Exempt Organization Extension | ✓ Implemented |                   |

---

## IRS Collection/Procedure

| Form   | Name                               | Status        | Notes        |
| ------ | ---------------------------------- | ------------- | ------------ |
| F9465  | Installment Agreement Request      | ✓ Implemented | Payment plan |
| F433-A | Collection Statement (Individuals) | ✓ Implemented |              |
| F433-B | Collection Statement (Businesses)  | ✓ Implemented |              |
| F656   | Offer in Compromise                | ✓ Implemented |              |
| F843   | Claim for Refund                   | ✓ Implemented |              |
| F8379  | Injured Spouse Allocation          | ✓ Implemented |              |
| F8862  | Credits After Disallowance         | ✓ Implemented |              |

---

## Employment/Payroll (Informational)

| Form  | Name                                  | Status        | Notes           |
| ----- | ------------------------------------- | ------------- | --------------- |
| F940  | Annual FUTA Tax Return                | ✓ Implemented |                 |
| F941  | Quarterly Payroll Tax Return          | ✓ Implemented |                 |
| F943  | Agricultural Payroll Tax              | ✓ Implemented |                 |
| F944  | Annual Payroll Tax Return             | ✓ Implemented | Small employers |
| F945  | Annual Withholding Return             | ✓ Implemented | Non-payroll     |
| F1096 | Annual Summary of Information Returns | ✓ Implemented |                 |

---

## Excise Taxes (Reference)

| Form  | Name                          | Status        | Notes |
| ----- | ----------------------------- | ------------- | ----- |
| F720  | Quarterly Federal Excise Tax  | ✓ Implemented |       |
| F2290 | Heavy Highway Vehicle Use Tax | ✓ Implemented |       |
| F6168 | Long-Term Contract Look-Back  | ✓ Implemented |       |

---

## OBBBA 2025 New Provisions

| Form/Feature     | Name                            | Status        | Notes                              |
| ---------------- | ------------------------------- | ------------- | ---------------------------------- |
| Schedule 1-A     | Additional Deductions           | ✓ Implemented | Overtime, tips, auto loan interest |
| F4547            | Trump Savings Account Elections | ✓ Implemented | New tax-advantaged account         |
| Senior Deduction | $6,000 Additional Deduction     | ✓ Implemented | Age 65+                            |

---

## Estate, Gift, and Fiduciary

| Form  | Name                        | Status        | Notes                            |
| ----- | --------------------------- | ------------- | -------------------------------- |
| F706  | Estate Tax Return           | ✓ Implemented | Estates over exemption threshold |
| F709  | Gift Tax Return             | ✓ Implemented | Gifts over annual exclusion      |
| F1041 | Fiduciary Income Tax Return | ✓ Implemented | Estates and trusts               |

---

## Exempt Organizations

| Form             | Name                           | Status        | Notes                 |
| ---------------- | ------------------------------ | ------------- | --------------------- |
| F990             | Exempt Organization Return     | ✓ Implemented | 501(c) organizations  |
| F990-EZ          | Short Form Exempt Organization | ✓ Implemented | Smaller organizations |
| F990-T           | Unrelated Business Income Tax  | ✓ Implemented | UBTI taxation         |
| F990-PF          | Private Foundation Return      | ✓ Implemented | Private foundations   |
| Schedule A (990) | Public Charity Status          | ✓ Implemented | Public support test   |

---

## Business Entity Schedules

| Schedule     | Form             | Name                         | Status        | Notes                      |
| ------------ | ---------------- | ---------------------------- | ------------- | -------------------------- |
| Schedule K   | 1065             | Partners' Distributive Share | ✓ Implemented | Partnership allocations    |
| Schedule K   | 1120-S           | Shareholders' Pro Rata Share | ✓ Implemented | S-Corp allocations         |
| Schedule L   | 1065/1120-S/1120 | Balance Sheets               | ✓ Implemented | Assets/liabilities         |
| Schedule M-1 | 1065/1120-S/1120 | Book-to-Tax Reconciliation   | ✓ Implemented | Book vs tax income         |
| Schedule K-1 | 1041             | Beneficiary's Share          | ✓ Implemented | Estate/trust distributions |

---

## Data Interface Properties

All forms have corresponding data interface properties in `src/core/data/index.ts` for the `Information` type. These allow form data to be passed from the UI to the form calculators.

---

## Integration Architecture

```
User Input (React Forms)
        ↓
Redux State (Information interface)
        ↓
F1040 Constructor (instantiates all forms)
        ↓
schedules() method (filters by isNeeded())
        ↓
PDF Generation (fields() → pdfFiller)
```

Each form:

1. Extends `F1040Attachment`
2. Implements `isNeeded()` to determine if form should be included
3. Implements `fields()` to provide PDF field values
4. Is instantiated in `F1040` constructor
5. Is added to `schedules()` array for rendering

---

## File Locations

- **Form Implementations**: `src/forms/Y2025/irsForms/`
- **Data Interfaces**: `src/core/data/index.ts`
- **PDF Templates**: `public/forms/Y2025/`
- **Tax Tables**: `src/forms/Y2025/data/federal.ts`

---

_Last Updated: January 2025_
