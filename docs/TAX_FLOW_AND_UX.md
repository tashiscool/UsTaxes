# Tax Flow and UI/UX Alignment

This document traces how the UsTaxes app flow aligns with federal tax law and form dependencies, and notes where the UI/UX is sensible or could be improved.

## 1. High-level data flow (from ARCHITECTURE.md)

- **Collect** (React forms) → **Store** (Redux) → **Calculate** (form models in `src/forms/Y20xx/irsForms/`) → **Export** (PDF fill + combine).
- Data flows one way; form logic reads from the same data model that the UI writes to.

## 2. Entry and navigation

| Step               | Route / Section                                                                         | Purpose                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Landing            | `/start` (Getting Started)                                                              | Explains supported forms, states, and credits; "Start Return In Browser" → `/info`.                 |
| Optional interview | `/interview`                                                                            | Guided wizard: personal → filing status → income → deductions → savings → credits → state → review. |
| Primary data entry | Drawer: Personal → Income → Payments → Deductions → Savings → Planning → Results → File | Same logical order as the interview.                                                                |

**Default route:** `Urls.default` is `Urls.usTaxes.start` (`/start`). Users can go straight to Primary Taxpayer (`/info`) from the start page. This is sensible: simple return filers can skip the interview; others can use it to discover what to enter.

## 3. Tax-law order vs UI order

### 3.1 IRS 1040 dependency order (conceptual)

Federal logic generally follows:

1. **Filing status and household** (who is filing, dependents) — drives standard deduction, many credits, and form eligibility.
2. **Income** — W-2, 1099s, business (Schedule C), rental (Schedule E), capital gains (Schedule D), etc. Many schedules flow into **Schedule 1** (additional income) and then to 1040 line 9.
3. **Deductions** — standard vs itemized (Schedule A); other deductions (e.g., student loan, OBBBA Schedule 1-A) also feed Schedule 1 and 1040.
4. **Tax and credits** — tax on taxable income; then nonrefundable credits (e.g., Child Tax Credit, Schedule 8812), then refundable credits (e.g., EIC, additional CTC). Payments and refund/amount owed follow.

The app respects this:

- **Personal** (Primary Taxpayer, Spouse and Dependents) is first — filing status and dependents are set before income/credits.
- **Income** is collected before **Deductions** and **Savings** (HSA/IRA), which matches “income before deductions.”
- **Deductions** (student loan, itemized) and **Savings** (HSA, IRA) are before **Results** (refund, questions, review).
- **Results** shows Summary (refund/owed, credits), Informational Questions, then Review and Print; **File** is last (e-file).

So the **navigation order is aligned with tax-law dependency**: identity/filing status → income → deductions → credits/results → file.

### 3.2 Interview flow order

`interviewFlow.ts` defines:

1. **About You** — marital status, spouse, dependents, children under 17.
2. **Filing Status** — filing status, spouse died recently.
3. **Employment Income** — W-2.
4. **Other Income** — 1099, interest, dividends, investment sales, retirement, Social Security, self-employment.
5. **Additional Income** — rental, stock options, partnership, estimated payments.
6. **Deductions** — itemizing, mortgage, SALT, charity, medical, student loan.
7. **Savings Accounts** — HSA, IRA.
8. **Tax Credits** — Child Tax Credit, EIC.
9. **State Taxes** — state of residence, multiple states.
10. **Review** — review complete.

This order matches the same dependency: personal/filing status first, then income (W-2 → other 1099/retirement/SS/SE → rental/partnership), then deductions and savings, then credits, then state and review. **The interview is built sensibly** relative to tax law.

### 3.3 Form generation order (`F1040.schedules()`)

In `src/forms/Y2025/irsForms/F1040.ts`, `schedules()` returns attachments in a fixed order. That order is used for **PDF assembly** (combine order). IRS instructions typically specify attachment order (e.g., 1040, then Schedules 1, 2, 3, then A, B, C, D, E, SE, etc.). The current code orders some schedules (e.g., A, B, D, E, SE, R, EIC, 8812, …) before Schedules 1, 2, 3. If you need to match IRS attachment order exactly, consider reordering the `schedules()` array so that Schedules 1, 2, 3 appear immediately after the 1040 and before Schedule A (or document that the current order is intentional for this app).

## 4. Where data is collected vs which forms use it

| UI section                               | Main data                                                      | Forms/schedules affected                                                      |
| ---------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Primary Taxpayer / Spouse and Dependents | Names, SSNs, filing status, dependents                         | 1040, Schedule EIC, Schedule 8812, standard deduction, etc.                   |
| Wages (W-2)                              | W-2s                                                           | 1040, Schedule 1, Schedule SE (if SE income), 8959, 8919, etc.                |
| Income (1099)                            | 1099-INT, -DIV, -B, -R, -NEC, SSA                              | Schedule B, Schedule D, Schedule 1, Schedule C (1099-NEC), Schedule EIC, etc. |
| Rental income                            | Rental income/expenses                                         | Schedule E                                                                    |
| Other investments                        | Assets / transactions                                          | Schedule D, 8949                                                              |
| Stock options / Partnership              | Stock options, K-1–like data                                   | 6251 (ISO), Schedule E, etc.                                                  |
| OBBBA (Y2025)                            | Overtime/tip exemptions, auto loan, senior deduction           | Schedule 1-A                                                                  |
| Estimated taxes                          | Estimated tax payments                                         | 1040 (payments), 2210                                                         |
| Student loan interest                    | 1098-E                                                         | Schedule 1 (adjustment)                                                       |
| Itemized deductions                      | SALT, mortgage, charity, medical                               | Schedule A                                                                    |
| HSA / IRA                                | HSA and IRA data                                               | 8889, 8853, 8606, 5329, etc.                                                  |
| Refund information                       | Refund / payment, account                                      | 1040 (refund or amount owed, direct deposit)                                  |
| Informational Questions                  | Crypto, foreign account, FinCEN 114, foreign trust, live apart | Conditional questions; can affect filing (e.g., FinCEN 114, 8938).            |

**Informational Questions** are shown in **Results**, after Refund. Some of these (e.g., foreign account, FinCEN 114) can affect which forms are required. Putting them in a “final check” step is a reasonable UX choice so users see them before filing; the important part is that the **logic** that decides which forms to include (e.g., 8938) uses the same answers.

## 5. Conditional logic and “required” forms

- **F1040Attachment.isNeeded()** controls whether a schedule is included in `schedules()` (and thus in the PDF). Each schedule implements this based on the shared data model.
- **getRequiredQuestions** in `src/core/data/questions.ts` decides which informational questions to show (e.g., FinCEN 114 only if foreign account exists). The UI and form logic both use the same `Information` state, so conditionals stay in sync.

## 6. Summary and Review

- **Summary** (`Summary.tsx` + `SummaryData.ts`): Shows refund/amount owed and credits (e.g., EIC, Child Tax Credit) and worksheets (e.g., qualified/cap gains) when a summary is defined for that year.
- **CreatePDF**: Builds federal (and state) forms from the same `YearCreateForm` pipeline, then offers “Create Federal 1040” and “Create [State] Return.” Errors from validation or form creation are shown in the Summary section.

**UX note:** `createSummary` in `SummaryData.ts` was only implemented for Y2020 and Y2021; Y2022–Y2025 returned `undefined`, so the Summary section showed no credits/worksheets for recent years. That has been fixed so Y2022–Y2025 also get a summary (refund/owed, EIC, Child Tax Credit, and qualified/cap gains worksheet when present).

## 7. Sensible UX summary

- **Order of sections** (Personal → Income → Payments → Deductions → Savings → Results → File) and **interview steps** follow tax-law dependency (filing status and household first, then income, then deductions, then credits and results).
- **Single data model** (Redux `Information` + assets) keeps UI input and form calculations consistent.
- **Conditional questions and attachments** are driven by the same state (e.g., `isNeeded()`, `getRequiredQuestions`), so the flow stays consistent with tax rules.
- **Getting Started** sets correct expectations (supported forms, states) and lets users choose between interview and direct data entry.

## 8. Entity and tax law alignment

For alignment of **all entities** (taxpayer, spouse, dependents, W-2, 1099, rental, credits, OBBBA, etc.) with **tax law docs** and with the **backend / Taxflow** entity model, see:

- **`docs/ENTITY_ALIGNMENT.md`** (at repo root): tax law sources, UsTaxes `Information` ↔ entity types, qualifying child/dependent rules, CTC/OBBBA constants, and checklist editPaths.

That doc ensures backend and frontend stay in sync with `docs/obbba/` and `docs/irs-forms/` for all entities.

## 9. Possible improvements

1. **PDF attachment order:** Align `F1040.schedules()` order with IRS attachment order (e.g., Schedules 1, 2, 3 before A, B, C, D, E) if required for submission or clarity.
2. **Schedule C / business income:** Schedule C data is entered via 1099-NEC and related flows rather than a dedicated “Schedule C” or “Business income” menu item. The interview asks “had_self_employment” and points to income. Consider a dedicated “Business income (Schedule C)” item in the Income section if user testing shows confusion.
3. **Informational Questions placement:** Keeping them in Results is fine; ensure any form that depends on these (e.g., 8938, FinCEN 114) is clearly mentioned in the Summary or review step when applicable.
4. **Year-specific pages:** OBBBA (Y2025) and Advance CTC (Y2021) are injected into the drawer for the active year; this keeps the flow consistent and avoids cluttering other years.

---

_Last updated: January 2026_
