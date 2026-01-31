# IRS MeF (Modernized e-File) Certification Guide

## Overview

MeF (Modernized e-File) is the IRS system for electronically filing tax returns. This guide covers how to become a certified e-file provider and integrate MeF capabilities into UsTaxes.

## Table of Contents

1. [What is MeF?](#what-is-mef)
2. [Provider Types](#provider-types)
3. [Certification Process](#certification-process)
4. [Technical Requirements](#technical-requirements)
5. [Development Guide](#development-guide)
6. [Testing (ATS)](#testing-ats)
7. [Production Deployment](#production-deployment)
8. [Annual Recertification](#annual-recertification)
9. [Resources](#resources)

---

## What is MeF?

MeF (Modernized e-File) is the IRS's web-based system for receiving electronically filed tax returns. It replaced the legacy ELF (Electronic Filing) system and supports:

- **Individual Returns**: Form 1040 and variants
- **Corporate Returns**: Forms 1120, 1120-S
- **Partnership Returns**: Form 1065
- **Employment Returns**: Forms 940, 941, 943, 944, 945
- **Estates & Trusts**: Form 1041
- **Exempt Organizations**: Forms 990, 990-EZ, 990-PF, 990-T
- **Excise Returns**: Forms 720, 2290, 8849
- **Extensions**: Forms 4868, 7004

### Benefits of MeF

| Benefit | Description |
|---------|-------------|
| Faster Processing | Returns processed within 24-48 hours |
| Immediate Acknowledgment | Know if return accepted/rejected instantly |
| Reduced Errors | XML validation catches errors before submission |
| Direct Deposit | Faster refunds via direct deposit |
| Audit Trail | Complete electronic record of submission |

---

## Provider Types

### Software Developer
- Develops software that formats returns per IRS specifications
- Creates XML files conforming to IRS schemas
- Does NOT transmit directly to IRS (unless also a Transmitter)
- **Suitability check exemption**: No background check required if software-only

### Transmitter
- Sends electronic return data directly to IRS
- Must have secure connection to IRS systems
- Requires additional security certifications
- Can transmit returns from multiple EROs

### Electronic Return Originator (ERO)
- Originates electronic returns (tax preparers)
- Collects taxpayer signatures (Form 8879)
- Responsible for return accuracy
- Requires suitability/background check

### For UsTaxes
We need to be certified as both **Software Developer** AND **Transmitter** to offer direct e-filing.

---

## Certification Process

### Step 1: Create IRS e-Services Account

1. Go to [IRS e-Services](https://www.irs.gov/e-file-providers/e-services-online-tools-for-tax-professionals)
2. Create account with ID.me verification
3. Complete identity proofing process

**Requirements:**
- Valid SSN or ITIN
- U.S. address
- Financial account information (for verification)
- Mobile phone for 2FA

### Step 2: Submit e-File Application

1. Log into e-Services
2. Select "e-File Application"
3. Choose provider types:
   - [x] Software Developer
   - [x] Transmitter
4. Provide business information:
   - Legal business name
   - EIN (Employer Identification Number)
   - Business address
   - Responsible Official information

**Timeline:** 4-6 weeks for approval

### Step 3: Obtain EFIN and ETIN

After approval, you receive:
- **EFIN** (Electronic Filing Identification Number) - 6 digits
- **ETIN** (Electronic Transmitter Identification Number) - For transmitters

### Step 4: Complete ATS Testing

See [Testing (ATS)](#testing-ats) section below.

### Step 5: Receive Production Access

After passing ATS:
- Receive Software Identification Number (STIN)
- Listed on IRS approved providers page
- Can transmit live returns

---

## Technical Requirements

### Communication Protocol

| Requirement | Specification |
|-------------|---------------|
| Protocol | SOAP 1.1 over HTTPS |
| Authentication | WS-Security with X.509 certificates |
| Encryption | TLS 1.2 or higher |
| Signatures | XML-DSIG with SHA-256 (SHA-1 rejected) |
| Format | XML per IRS MeF schemas |

### XML Schema Requirements

```
MeF XML Structure:
├── ReturnHeader
│   ├── ReturnTs (timestamp)
│   ├── TaxYr
│   ├── TaxPeriodBeginDt
│   ├── TaxPeriodEndDt
│   ├── SoftwareId
│   └── OriginatorGrp
├── ReturnData
│   ├── IRS1040 (or other form)
│   ├── IRS1040ScheduleA
│   ├── IRS1040ScheduleB
│   └── ... (attachments)
└── ReturnSignature (if applicable)
```

### Security Requirements

1. **Digital Certificates**
   - X.509 certificates from IRS-approved CA
   - RSA 2048-bit or higher
   - Valid chain to trusted root

2. **XML Signatures**
   - Enveloped signature format
   - SHA-256 digest algorithm (minimum)
   - RSA-SHA256 signature algorithm

3. **Transport Security**
   - TLS 1.2 minimum
   - Strong cipher suites only
   - Certificate pinning recommended

### System Requirements

| Component | Requirement |
|-----------|-------------|
| Availability | 99.5% uptime for production systems |
| Response Time | Process IRS acknowledgments within 24 hours |
| Data Retention | 3 years minimum (7 years recommended) |
| Audit Logging | All transmissions logged with timestamps |
| Disaster Recovery | Documented backup/recovery procedures |

---

## Development Guide

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      UsTaxes Application                      │
├─────────────────────────────────────────────────────────────┤
│  Form Data (Redux)  →  XML Serializer  →  MeF Client        │
│                              ↓                ↓              │
│                        Validation      SOAP Request          │
│                              ↓                ↓              │
│                        Business Rules   XML Signature        │
│                              ↓                ↓              │
│                        Error Report     Transmission         │
└─────────────────────────────────────────────────────────────┘
                               ↓
                    ┌─────────────────────┐
                    │   IRS MeF Gateway   │
                    └─────────────────────┘
                               ↓
                    ┌─────────────────────┐
                    │  Acknowledgment     │
                    │  (Accept/Reject)    │
                    └─────────────────────┘
```

### Key Components

#### 1. XML Serializer
Converts UsTaxes form data to IRS XML format.

```typescript
// Example: Convert F1040 to XML
const xml = serializer.serialize(f1040, {
  taxYear: 2025,
  softwareId: 'USTAXES2025',
  transmitterId: 'XXXXX'
});
```

#### 2. Schema Validator
Validates XML against IRS schemas before submission.

```typescript
const errors = validator.validate(xml, 'IRS1040');
if (errors.length > 0) {
  // Handle validation errors
}
```

#### 3. Business Rules Engine
Applies IRS business rules (beyond schema validation).

```typescript
const ruleErrors = businessRules.check(returnData);
// Example: "Line 11 must equal sum of lines 1-10"
```

#### 4. XML Signer
Signs XML with SHA-256 digital signature.

```typescript
const signedXml = signer.sign(xml, {
  certificate: cert,
  privateKey: key,
  algorithm: 'RSA-SHA256'
});
```

#### 5. SOAP Client
Communicates with IRS MeF web services.

```typescript
const response = await mefClient.submitReturn(signedXml);
// Returns: SubmissionId, Timestamp, Status
```

#### 6. Acknowledgment Processor
Handles IRS responses (accepted/rejected).

```typescript
const ack = await mefClient.getAcknowledgment(submissionId);
if (ack.status === 'Accepted') {
  // Store confirmation number
} else {
  // Process rejection errors
}
```

### MeF Web Services

| Service | Description |
|---------|-------------|
| `Login` | Authenticate transmitter |
| `SubmitReturn` | Submit a tax return |
| `GetAck` | Retrieve acknowledgment |
| `GetSubmissionStatus` | Check submission status |
| `GetNewAcks` | Get all new acknowledgments |
| `GetStateSubmission` | For state e-file (if applicable) |

### WSDL Endpoints

**ATS (Testing):**
```
https://la.www4.irs.gov/a2a/MEFATS/MeFTransmitterService.wsdl
```

**Production:**
```
https://la.www4.irs.gov/a2a/MEF/MeFTransmitterService.wsdl
```

---

## Testing (ATS)

### Assurance Testing System

ATS is the IRS test environment where you validate your software before production.

### Test Scenarios

For each form type, you must submit test returns that cover:

1. **Simple Returns** - Basic scenarios
2. **Complex Returns** - Multiple schedules, attachments
3. **Edge Cases** - Boundary conditions
4. **Error Scenarios** - Known rejection conditions

### ATS Process

```
1. Request ATS access via e-Services
         ↓
2. Download test scenarios from IRS
         ↓
3. Generate XML for each scenario
         ↓
4. Submit to ATS environment
         ↓
5. Verify acknowledgments match expected results
         ↓
6. Complete ATS questionnaire
         ↓
7. IRS reviews and approves
```

### Required Test Categories

| Category | Description |
|----------|-------------|
| Accept | Returns that should be accepted |
| Reject | Returns with intentional errors (test error handling) |
| Alert | Returns with warnings but still accepted |

### ATS Timeline

| Phase | Duration |
|-------|----------|
| ATS Environment Access | 1-2 weeks |
| Test Development | 2-4 weeks |
| Test Execution | 1-2 weeks |
| Issue Resolution | 1-2 weeks |
| IRS Review | 1-2 weeks |
| **Total** | **6-12 weeks** |

---

## Production Deployment

### Pre-Production Checklist

- [ ] All ATS scenarios passed
- [ ] ATS questionnaire completed
- [ ] Software ID (STIN) received
- [ ] Production certificates installed
- [ ] Error handling tested
- [ ] Logging and audit trails verified
- [ ] Disaster recovery tested
- [ ] User documentation complete

### Go-Live Process

1. **Soft Launch** - Limited users, monitor closely
2. **Gradual Rollout** - Increase user base
3. **Full Production** - All users enabled

### Monitoring

Track these metrics:
- Acceptance rate (target: >98%)
- Rejection reasons (categorize and fix)
- Response times
- System availability

---

## Annual Recertification

### Requirements

Each tax year requires:
1. Download new schemas/WSDLs
2. Update software for tax law changes
3. Pass ATS testing again
4. Submit new questionnaire

### Timeline

| Month | Activity |
|-------|----------|
| October | New schemas released |
| November | Development/updates |
| December | ATS testing |
| January | Production ready |

---

## Resources

### Official IRS Publications

| Publication | Description |
|-------------|-------------|
| [Publication 3112](https://www.irs.gov/pub/irs-pdf/p3112.pdf) | IRS e-File Application & Participation |
| [Publication 4163](https://www.irs.gov/pub/irs-pdf/p4163.pdf) | MeF Information for Business Returns |
| [Publication 4164](https://www.irs.gov/pub/irs-pdf/p4164.pdf) | MeF Guide for Software Developers |
| [Publication 1345](https://www.irs.gov/pub/irs-pdf/p1345.pdf) | Handbook for Authorized e-File Providers |

### IRS Websites

- [MeF Program Information](https://www.irs.gov/e-file-providers/modernized-e-file-program-information)
- [MeF User Guides](https://www.irs.gov/e-file-providers/modernized-e-file-mef-user-guides-and-publications)
- [MeF Status Page](https://www.irs.gov/e-file-providers/modernized-e-file-mef-status)
- [Become an e-File Provider](https://www.irs.gov/e-file-providers/become-an-authorized-e-file-provider)
- [Software Developer Fact Sheet](https://www.irs.gov/e-file-providers/software-developers-technical-fact-sheet)

### Technical Resources

- [A2A MeF SDK Toolkit](https://www.irs.gov/e-file-providers/information-and-technical-guidance-for-software-developers-and-transmitters)
- [XML Schemas (IRS)](https://www.irs.gov/e-file-providers/modernized-e-file-mef-schemas-and-business-rules)

---

## Cost Summary

| Item | Cost |
|------|------|
| IRS Application Fee | **$0** (Free) |
| IRS ATS Testing | **$0** (Free) |
| Digital Certificates | $200-500/year |
| Development Time | 3-6 months FTE |
| Infrastructure | Varies (hosting, security) |
| Annual Maintenance | Ongoing development |

---

## Alternative Approaches

If full MeF certification is too complex, consider:

### 1. Partner with Existing Transmitter
- Use established transmitter's infrastructure
- Pay per-return fee
- Faster time to market

### 2. IRS Free File Integration
- For AGI < $84,000 (2025)
- Partner with Free File Alliance
- Limited to eligible taxpayers

### 3. PDF Generation Only
- Current UsTaxes approach
- Users print and mail, or use IRS Direct File
- No certification required

---

## UsTaxes MeF Implementation

See `/src/efile/` directory for the MeF implementation:

```
src/efile/
├── mef/
│   ├── client.ts           # SOAP client for IRS
│   ├── schemas/            # IRS XML schemas
│   ├── serializer.ts       # Form → XML conversion
│   ├── signer.ts           # XML digital signatures
│   └── transmitter.ts      # Transmission logic
├── validation/
│   ├── schemaValidator.ts  # XML schema validation
│   └── businessRules.ts    # IRS business rules
├── status/
│   ├── acknowledgment.ts   # Process IRS responses
│   └── statusTracker.ts    # Track submission status
└── types/
    └── mefTypes.ts         # TypeScript interfaces
```

---

*Last Updated: January 2025*
*For UsTaxes v0.2.0+*
