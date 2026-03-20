import {
  PDFDocument,
  PDFCheckBox,
  PDFTextField,
  PDFName,
  PDFField
} from 'pdf-lib'
import { Field } from '.'
import { displayRound } from '../irsForms/util'
import _ from 'lodash'

/**
 * Attempt to fill fields in a PDF from a Form,
 * checking one by one that each pdf field and Form value
 * Make sense by type (checkbox => boolean, textField => string / number)
 * Side-effecting! Modifies the pdf document.
 */
const coerceCheckboxValue = (value: Field): boolean | undefined => {
  if (value === undefined) {
    return false
  }
  if (value === true || value === false) {
    return value
  }
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
    return undefined
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (
      normalized === 'true' ||
      normalized === 'yes' ||
      normalized === 'y' ||
      normalized === '1' ||
      normalized === 'x' ||
      normalized === 'checked' ||
      normalized === 'on'
    ) {
      return true
    }
    if (
      normalized === '' ||
      normalized === 'false' ||
      normalized === 'no' ||
      normalized === 'n' ||
      normalized === '0' ||
      normalized === 'not set' ||
      normalized === 'off' ||
      normalized === 'unchecked'
    ) {
      return false
    }
  }
  return undefined
}

const fillSingleField = (
  pdfField: PDFField,
  value: Field,
  formName: string,
  index: number
) => {
  const error = (expected: string): Error => {
    return new Error(
      `${formName} Field ${index}, ${pdfField.getName()} expected ${expected}`
    )
  }

  // First handle radio groups. If the value for this field
  // is a RadioSelect object, then assume the pdfField
  // has children, and check the correct box given the index value.
  // Idea taken from this comment:
  // https://github.com/Hopding/pdf-lib/issues/780#issuecomment-771453157
  // Note, this is for cases such as the 2021 IL-1040 where the field
  // behaves as a radio group, but the pdfField is a PDFCheckbox
  // instead of a PDFRadioGroup.
  if (_.isObject(value)) {
    const children = pdfField.acroField.getWidgets()
    if (value.select >= children.length) {
      throw new Error(
        `Error in field ${index}, expected to select child at index ${value.select} but this node has only ${children.length} children.`
      )
    }
    const setValue = children[value.select].getOnValue()
    if (setValue !== undefined) {
      pdfField.acroField.dict.set(PDFName.of('V'), setValue)
      children[value.select].setAppearanceState(setValue)
    } else {
      console.error(children)
      throw new Error(
        `Error handling RadioGroup, could not set index ${value.select}`
      )
    }
  } else if (pdfField instanceof PDFCheckBox) {
    const checkboxValue = coerceCheckboxValue(value)
    if (checkboxValue === true) {
      pdfField.check()
    } else if (checkboxValue === undefined) {
      throw error('boolean')
    }
  } else if (pdfField instanceof PDFTextField) {
    try {
      const showValue =
        !isNaN(value as number) &&
        value &&
        Array.from(value as string)[0] !== '0'
          ? displayRound(value as number)?.toString()
          : value?.toString()
      pdfField.setText(showValue)
    } catch (err) {
      throw error('text field')
    }
  } else if (value !== undefined) {
    throw error('unknown')
  }
  pdfField.enableReadOnly()
}

const tryFillSingleField = (
  pdfField: PDFField,
  value: Field
): boolean => {
  try {
    if (_.isObject(value)) {
      const children = pdfField.acroField.getWidgets()
      if (value.select >= children.length) {
        return false
      }
      const setValue = children[value.select].getOnValue()
      if (setValue === undefined) {
        return false
      }
      pdfField.acroField.dict.set(PDFName.of('V'), setValue)
      children[value.select].setAppearanceState(setValue)
      pdfField.enableReadOnly()
      return true
    }

    if (pdfField instanceof PDFCheckBox) {
      const checkboxValue = coerceCheckboxValue(value)
      if (checkboxValue === undefined) {
        return false
      }
      if (checkboxValue) {
        pdfField.check()
      }
      pdfField.enableReadOnly()
      return true
    }

    if (pdfField instanceof PDFTextField) {
      if (typeof value === 'boolean' || _.isObject(value)) {
        return false
      }
      const showValue =
        !isNaN(value as number) &&
        value &&
        Array.from(value as string)[0] !== '0'
          ? displayRound(value as number)?.toString()
          : value?.toString()
      if (showValue !== undefined) {
        pdfField.setText(showValue)
      }
      pdfField.enableReadOnly()
      return true
    }

    if (value !== undefined) {
      return false
    }
    pdfField.enableReadOnly()
    return true
  } catch {
    return false
  }
}

export function fillPDF(
  pdf: PDFDocument,
  fieldValues: Field[],
  formName: string
): PDFDocument {
  const formFields = pdf.getForm().getFields()

  formFields.forEach((pdfField, index) => {
    fillSingleField(pdfField, fieldValues[index], formName, index)
  })

  return pdf
}

export function fillPDFByLeafMap(
  pdf: PDFDocument,
  fieldValues: Field[],
  formName: string,
  sourceLeaves: readonly string[]
): PDFDocument {
  const targetFields = pdf.getForm().getFields()
  const targetByLeaf = new Map<string, PDFField[]>()
  for (const targetField of targetFields) {
    const leaf = targetField.getName().split('.').pop()
    if (!leaf) continue
    const existing = targetByLeaf.get(leaf) ?? []
    existing.push(targetField)
    targetByLeaf.set(leaf, existing)
  }

  fieldValues.forEach((value, index) => {
    const leaf = sourceLeaves[index]
    if (!leaf) return
    const candidates = targetByLeaf.get(leaf)
    const targetField = candidates?.shift()
    if (!targetField) return
    tryFillSingleField(targetField, value)
  })

  targetFields.forEach((field) => field.enableReadOnly())
  return pdf
}
