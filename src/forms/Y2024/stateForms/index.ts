import F1040 from '../irsForms/F1040'
import { State } from 'ustaxes/core/data'
import StateForm from 'ustaxes/core/stateForms/Form'
import { Either } from 'ustaxes/core/util'
import { createStateReturn as createStateReturnF } from '../../StateForms'
import { StateFormError } from '../../StateForms'

// Import state forms
import makeAZ140 from './AZ/AZ140'
import makeCA540 from './CA/CA540'
import makeIL1040 from './IL/IL1040'
import makeMA1 from './MA/MA1'
import makeNJ1040 from './NJ/NJ1040'
import makeNYIT201 from './NY/NYIT201'
import makePA40 from './PA/PA40'

/**
 * States with no personal income tax filing requirement
 * These states are part of the Direct File pilot program
 */
export const noFilingRequirementStates: State[] = [
  'AK', // Alaska - no income tax
  'FL', // Florida - no income tax (Direct File pilot)
  'NV', // Nevada - no income tax (Direct File pilot)
  'NH', // New Hampshire - no income tax on wages (Direct File pilot)
  'SD', // South Dakota - no income tax (Direct File pilot)
  'TN', // Tennessee - no income tax (Direct File pilot)
  'TX', // Texas - no income tax (Direct File pilot)
  'WA', // Washington - no income tax (Direct File pilot)
  'WY' // Wyoming - no income tax (Direct File pilot)
]

/**
 * State form generators for states with income tax
 * Each entry maps a state code to a function that creates the state form
 *
 * Direct File pilot states with income tax:
 * - AZ: Arizona Form 140 (flat 2.5% rate)
 * - CA: California Form 540 (progressive 1%-12.3% + 1% mental health tax)
 * - IL: Illinois IL-1040 (flat 4.95% rate)
 * - MA: Massachusetts Form 1 (flat 5% + 4% millionaire's tax)
 * - NJ: New Jersey NJ-1040 (progressive 1.4%-10.75%)
 * - NY: New York IT-201 (progressive 4%-10.9%)
 * - PA: Pennsylvania PA-40 (flat 3.07% rate)
 */
export const stateForms: {
  [K in State]?: (f1040: F1040) => StateForm
} = {
  AZ: makeAZ140,
  CA: makeCA540,
  IL: makeIL1040,
  MA: makeMA1,
  NJ: makeNJ1040,
  NY: makeNYIT201,
  PA: makePA40
}

/**
 * Create state return(s) for a given F1040
 *
 * @param f1040 The federal Form 1040
 * @returns Either an array of errors or an array of state forms
 */
export const createStateReturn = (
  f1040: F1040
): Either<StateFormError[], StateForm[]> =>
  createStateReturnF<F1040>(noFilingRequirementStates, stateForms)(f1040)
