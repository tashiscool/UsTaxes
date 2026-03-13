import type { DirectFileFacts } from './directFileFacts'

export interface FactGraphValidationIssue {
  path: string
  message: string
}

const asObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const isNumericString = (value: string): boolean => /^\d+$/.test(value)

const validateTinWrapper = (
  path: string,
  item: unknown,
  issues: FactGraphValidationIssue[]
): void => {
  const record = asObject(item)
  if (!record) {
    issues.push({
      path,
      message: 'TinWrapper.item must be an object'
    })
    return
  }

  const area = record.area
  const group = record.group
  const serial = record.serial

  if (
    typeof area !== 'string' ||
    typeof group !== 'string' ||
    typeof serial !== 'string' ||
    !isNumericString(area) ||
    !isNumericString(group) ||
    !isNumericString(serial) ||
    area.length !== 3 ||
    group.length !== 2 ||
    serial.length !== 4
  ) {
    issues.push({
      path,
      message:
        'TinWrapper.item must include area(3), group(2), serial(4) numeric strings'
    })
  }
}

const validateEinWrapper = (
  path: string,
  item: unknown,
  issues: FactGraphValidationIssue[]
): void => {
  const record = asObject(item)
  if (!record) {
    issues.push({
      path,
      message: 'EinWrapper.item must be an object'
    })
    return
  }

  const prefix = record.prefix
  const serial = record.serial ?? record.suffix
  if (
    typeof prefix !== 'string' ||
    typeof serial !== 'string' ||
    !isNumericString(prefix) ||
    !isNumericString(serial) ||
    prefix.length !== 2 ||
    serial.length !== 7
  ) {
    issues.push({
      path,
      message:
        'EinWrapper.item must include prefix(2) and serial/suffix(7) numeric strings'
    })
  }
}

const validateEnumWrapper = (
  path: string,
  item: unknown,
  issues: FactGraphValidationIssue[]
): void => {
  const record = asObject(item)
  if (!record) {
    issues.push({
      path,
      message: 'EnumWrapper.item must be an object'
    })
    return
  }

  const value = record.value
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    typeof value[0] !== 'string'
  ) {
    issues.push({
      path,
      message: 'EnumWrapper.item.value must be a non-empty string array'
    })
  }
}

const validateAddressWrapper = (
  path: string,
  item: unknown,
  issues: FactGraphValidationIssue[]
): void => {
  const record = asObject(item)
  if (!record) {
    issues.push({
      path,
      message: 'AddressWrapper.item must be an object'
    })
    return
  }

  const requiredFields = [
    'streetAddress',
    'city',
    'postalCode',
    'stateOrProvence'
  ] as const
  for (const field of requiredFields) {
    if (
      typeof record[field] !== 'string' ||
      record[field].trim().length === 0
    ) {
      issues.push({
        path,
        message: `AddressWrapper.item.${field} must be a non-empty string`
      })
    }
  }
}

const validateDollarWrapper = (
  path: string,
  item: unknown,
  issues: FactGraphValidationIssue[]
): void => {
  if (typeof item === 'number' && Number.isFinite(item)) {
    return
  }

  if (typeof item === 'string' && /^-?\d+(\.\d{1,2})?$/.test(item)) {
    return
  }

  issues.push({
    path,
    message:
      'DollarWrapper.item must be a finite number or decimal string with up to 2 fraction digits'
  })
}

const validatePinWrapper = (
  path: string,
  item: unknown,
  issues: FactGraphValidationIssue[]
): void => {
  const record = asObject(item)
  const pin = record?.pin
  if (typeof pin !== 'string' || !/^\d{5}$/.test(pin)) {
    issues.push({
      path,
      message: 'PinWrapper.item.pin must be a 5-digit string'
    })
  }
}

const validateTypedFact = (
  path: string,
  typeName: string,
  item: unknown,
  issues: FactGraphValidationIssue[]
): void => {
  if (typeName.endsWith('TinWrapper')) {
    validateTinWrapper(path, item, issues)
    return
  }
  if (typeName.endsWith('EinWrapper')) {
    validateEinWrapper(path, item, issues)
    return
  }
  if (typeName.endsWith('EnumWrapper')) {
    validateEnumWrapper(path, item, issues)
    return
  }
  if (typeName.endsWith('AddressWrapper')) {
    validateAddressWrapper(path, item, issues)
    return
  }
  if (typeName.endsWith('DollarWrapper')) {
    validateDollarWrapper(path, item, issues)
    return
  }
  if (typeName.endsWith('PinWrapper')) {
    validatePinWrapper(path, item, issues)
    return
  }

  if (typeName.endsWith('BooleanWrapper') && typeof item !== 'boolean') {
    issues.push({
      path,
      message: 'BooleanWrapper.item must be a boolean'
    })
    return
  }

  if (typeName.endsWith('IntWrapper') && !Number.isInteger(item)) {
    issues.push({
      path,
      message: 'IntWrapper.item must be an integer'
    })
  }
}

export const validateDirectFileFacts = (
  facts: DirectFileFacts
): FactGraphValidationIssue[] => {
  const issues: FactGraphValidationIssue[] = []

  for (const [path, rawValue] of Object.entries(facts)) {
    if (!path.startsWith('/')) {
      issues.push({
        path,
        message: 'Fact path must start with "/"'
      })
      continue
    }

    const fact = asObject(rawValue)
    if (!fact) {
      issues.push({
        path,
        message: 'Fact value must be an object with "$type" and "item"'
      })
      continue
    }

    const typeName = fact.$type
    if (typeof typeName !== 'string' || typeName.trim().length === 0) {
      issues.push({
        path,
        message: 'Fact "$type" must be a non-empty string'
      })
      continue
    }

    if (!Object.hasOwn(fact, 'item')) {
      issues.push({
        path,
        message: 'Fact must include an "item" property'
      })
      continue
    }

    validateTypedFact(path, typeName, fact.item, issues)
  }

  return issues
}
