<div align="center">
<h1><a href="//ustaxes.org">USTaxes</a></h1>

[![Netlify Status][netlify-badge]][netlify-url] [![Github Latest Release][release-badge]][github-release] [![discord-badge]][discord-url] [![OpenSSF Best Practices](https://www.bestpractices.dev/projects/9884/badge)](https://www.bestpractices.dev/projects/9884)

</div>

## What is UsTaxes?

UsTaxes is a free, open-source tax filing application that can be used to file the Federal 1040 form. It is available in both [web](https://ustaxes.org/) and [desktop][desktop-releases] versions. It is provided free of charge and requires no sharing of personal data.

**Interested in contributing? [Get Started](#user-content-get-started)**

## Supported Tax Years

- **2025** - Comprehensive support (131 forms, see [Form Documentation](docs/FORMS_Y2025.md))
- **2024** - Full support
- **2023** - Full support
- **2022** - Full support
- **2021** - Full support
- **2020** - Full support

## Supported Income Data

### Income Forms

- W-2 (Wages)
- All 1099 variants (INT, DIV, B, R, MISC, NEC, G, SSA, K)
- 1098-E (Student Loan Interest)
- Schedule K-1 (Partnership/S-Corp income)

### Schedules (2025)

- Schedule 1 (Additional Income and Adjustments)
- Schedule 1-A (OBBBA 2025 Additional Deductions)
- Schedule 2 (Additional Taxes)
- Schedule 3 (Additional Credits)
- Schedule A (Itemized Deductions)
- Schedule B (Interest and Dividends)
- Schedule C (Self-Employment)
- Schedule D (Capital Gains)
- Schedule E (Rental/Royalty/K-1)
- Schedule F (Farm Income)
- Schedule H (Household Employment)
- Schedule J (Farm Income Averaging)
- Schedule R (Elderly/Disabled Credit)
- Schedule SE (Self-Employment Tax)
- Schedule 8812 (Child Tax Credit)
- Schedule EIC (Earned Income Credit)
- And 100+ additional forms (see [full list](docs/FORMS_Y2025.md))

## Supported Credits

### Refundable Credits

- Child Tax Credit / Additional Child Tax Credit
- Earned Income Credit
- American Opportunity Credit (F8863)
- Premium Tax Credit / ACA Subsidy (F8962)

### Nonrefundable Credits

- Child and Dependent Care Credit (F2441)
- Residential Energy Credits (F5695)
- Clean Vehicle Credit (F8936)
- Saver's Credit (F8880)
- Foreign Tax Credit (F1116)
- Education Credits (F8863)
- Adoption Credit (F8839)
- 18+ Business Credits via F3800

## Business Support

- Schedule C (Self-Employment)
- Depreciation (F4562 with Section 179)
- Home Office (F8829)
- At-Risk Limitations (F6198)
- Passive Activity Loss (F8582)
- Installment Sales (F6252)
- Like-Kind Exchanges (F8824)
- General Business Credits (F3800 ecosystem)

## Supported states

### Implemented State returns

The states below have been implemented partially for tax year 2021. See the `/src/stateForms/<state>/<relevant form>` file for details on unimplemented portions.

- Illinois

### Non-filing states

Users who only have wage income and live in the states below should be able to file taxes using this site, since they do not have state level income tax.

- Alaska
- Florida
- Nevada
- New Hampshire
- South Dakota
- Tennessee
- Texas
- Washington
- Wyoming

## Note on using this project

This project is built by a growing community. If you notice an error in the outputted PDF or any other error, please submit an issue on the Github issues tab. We appreciate your feedback!

## User Data

The project is available strictly via client side. Data is persisted to the site's localstorage so _no personal information ever leaves the user's computer._ For those who want extra security, the codebase can also be built as a [desktop application](#desktop-application).

## Contributing

Thank you for taking the time to contribute; let's make tax filing free for everyone!

To ensure the project is fun for every contributor, please review:

- [Code of conduct](docs/CODE_OF_CONDUCT.md)
- [Contributing guide](docs/CONTRIBUTING.md)
- [Project Architecture](docs/ARCHITECTURE.md)
- [Form Implementation Status (Y2025)](docs/FORMS_Y2025.md)
- [Forms Roadmap](docs/FORMS_ROADMAP.md)

## Get Started

This application can be run as either a web application or a [standalone desktop application](#user-content-desktop-application)

### Web application

This project runs on Node 20. To ensure you're on the proper version, we recommend [nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

With `nvm` installed, you may select a version 20 node using:

```sh
nvm install 20
nvm use 20
```

To run,

```sh
npm ci          # install package dependencies
npm run start   # run app
```

Note: To avoid having to set your node versions, we suggest using a tool like [direnv](https://direnv.net). With the following configuration file as `.envrc` in project root:

```sh
export NVM_DIR="$HOME/.nvm"

. "$NVM_DIR/nvm.sh"  # This loads nvm
#. "$NVM_DIR/bash_completion"  # Optional, nvm bash completion

nvm install 20
nvm use 20
```

your environment will be set up every time you enter the project directory.

#### Docker

If preferred, a Docker alternative is available:

```sh
docker-compose build
docker-compose up
```

Open a browser to `http://localhost:3000`.

To stop and remove running containers, run `docker-compose down`.

### Desktop application

The desktop application is built with [Tauri][tauri-root]. In addition to the above steps, please [follow this reference for setting up your environment for Tauri][tauri-setup].

Once your environment is set up for Tauri, run, `npm run desktop`. To avoid a browser window being spawned in addition to the desktop window, just set the BROWSER environment variable as in: `BROWSER=none npm run desktop`.

To build executables, run `npm run desktop-release`.

## Getting help

Please reach out to us on our [discord][discord-url] if you run into any problems, or [file an issue][github-issues]. Thank you for your support!

[netlify-badge]: https://api.netlify.com/api/v1/badges/41efe456-a85d-4fed-9fcf-55fe4d5aa7fa/deploy-status
[netlify-url]: https://app.netlify.com/sites/peaceful-joliot-d51349/deploys
[cargo-docs]: https://doc.rust-lang.org/cargo/getting-started/installation.html
[discord-badge]: https://img.shields.io/discord/812156892343828500?logo=Discord
[discord-url]: https://discord.gg/dAaz472mPz
[github-release]: https://github.com/ustaxes/UsTaxes/releases/latest
[release-badge]: https://badgen.net/github/release/ustaxes/ustaxes
[desktop-releases]: https://github.com/ustaxes/UsTaxes/releases/
[github-issues]: https://github.com/ustaxes/ustaxes/issues
[tauri-setup]: https://tauri.studio/en/docs/getting-started/intro/#setting-up-your-environment
[tauri-root]: https://tauri.studio
