# Local Test Execution Report (2026-03-12)

## 1) Cloudflare backend (UsTaxes/backend-cloudflare)

Command:

- `npm run backend:cf:test:all`

Result:

- PASS
- Test files: 17/17 passed
- Tests: 69/69 passed
- Includes runtime integration tests using local Cloudflare Worker harness (`unstable_dev`) with D1 migrations applied to ephemeral local state.

## 1b) Cloudflare runtime-only gate

Command:

- `npm --prefix ./backend-cloudflare run test:runtime`

Result:

- PASS
- Test files: 1/1 passed
- Tests: 3/3 passed

## 2) UsTaxes Node ATS suite

Command:

- `npx craco test src/tests/ats --watchAll=false --runInBand`

Result:

- PASS
- Test suites: 34/34 passed
- Tests: 1192/1192 passed

## 3) Direct File backend full suite (direct-file/backend)

Command:

- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw test`

Result:

- FAIL
- Tests run: 409
- Failures: 0
- Errors: 102
- Primary blocker: Spring context initialization fails while creating `factGraphService` with `java.lang.IllegalArgumentException: Enum must contain optionsPath` from FactGraph XML loading.

## 4) Direct File targeted ATS conversion suites

Command:

- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=FactGraphATSScenarioTest,ATSToFactGraphConverterTest test`

Result:

- PASS
- Total tests run: 150
- Passed: 150
- Errors: 0
- `FactGraphATSScenarioTest` passed, including scenario loading/conversion/expected-value checks across provider scenarios.
- `ATSToFactGraphConverterTest` now passes, including `testMultipleW2Conversion`.
