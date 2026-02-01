import F1040 from '../irsForms/F1040'
import { State } from 'ustaxes/core/data'
import StateForm from 'ustaxes/core/stateForms/Form'
import { Either } from 'ustaxes/core/util'
import { createStateReturn as createStateReturnF } from '../../StateForms'
import { StateFormError } from '../../StateForms'

// Import state forms - All 41 states with income tax
import makeAL40 from './AL/AL40'
import makeAR1000 from './AR/AR1000'
import makeAZ140 from './AZ/AZ140'
import makeCA540 from './CA/CA540'
import makeCO104 from './CO/CO104'
import makeCT1040 from './CT/CT1040'
import makeDCD40 from './DC/DCD40'
import makeDE200_01 from './DE/DE200_01'
import makeGA500 from './GA/GA500'
import makeHIN11 from './HI/HIN11'
import makeIA1040 from './IA/IA1040'
import makeID40 from './ID/ID40'
import makeIL1040 from './IL/IL1040'
import makeINIT40 from './IN/INIT40'
import makeKS40 from './KS/KS40'
import makeKY740 from './KY/KY740'
import makeLAIT540 from './LA/LAIT540'
import makeMA1 from './MA/MA1'
import makeMD502 from './MD/MD502'
import makeME1040 from './ME/ME1040'
import makeMI1040 from './MI/MI1040'
import makeMNM1 from './MN/MNM1'
import makeMO1040 from './MO/MO1040'
import makeMS80105 from './MS/MS80105'
import makeMT2 from './MT/MT2'
import makeNCD400 from './NC/NCD400'
import makeND1 from './ND/ND1'
import makeNE1040N from './NE/NE1040N'
import makeNJ1040 from './NJ/NJ1040'
import makeNMPIT1 from './NM/NMPIT1'
import makeNYIT201 from './NY/NYIT201'
import makeOHIT1040 from './OH/OHIT1040'
import makeOK511 from './OK/OK511'
import makeOR40 from './OR/OR40'
import makePA40 from './PA/PA40'
import makeRI1040 from './RI/RI1040'
import makeSC1040 from './SC/SC1040'
import makeUTTC40 from './UT/UTTC40'
import makeVA760 from './VA/VA760'
import makeVTIN111 from './VT/VTIN111'
import makeWI1 from './WI/WI1'
import makeWVIT140 from './WV/WVIT140'

/**
 * States with no personal income tax filing requirement
 */
export const noFilingRequirementStates: State[] = [
  'AK', // Alaska - no income tax
  'FL', // Florida - no income tax
  'NV', // Nevada - no income tax
  'NH', // New Hampshire - no income tax on wages
  'SD', // South Dakota - no income tax
  'TN', // Tennessee - no income tax
  'TX', // Texas - no income tax
  'WA', // Washington - no income tax
  'WY' // Wyoming - no income tax
]

/**
 * State form generators for states with income tax
 * Each entry maps a state code to a function that creates the state form
 *
 * Implemented states for 2025 (41 states + DC):
 * - AL: Alabama Form 40 (progressive 2%-5%)
 * - AR: Arkansas Form AR1000 (progressive 0.9%-4.4%)
 * - AZ: Arizona Form 140 (flat 2.5% rate)
 * - CA: California Form 540 (progressive 1%-12.3% + 1% mental health tax)
 * - CO: Colorado DR 0104 (flat 4.4% rate)
 * - CT: Connecticut CT-1040 (progressive 2%-6.99%)
 * - DC: District of Columbia D-40 (progressive 4%-10.75%)
 * - DE: Delaware Form 200-01 (progressive 0%-6.6%)
 * - GA: Georgia Form 500 (flat 5.39% rate)
 * - HI: Hawaii Form N-11 (progressive 1.4%-11%)
 * - IA: Iowa Form 1040 (progressive 4.4%-5.7%)
 * - ID: Idaho Form 40 (flat 5.695%)
 * - IL: Illinois IL-1040 (flat 4.95% rate)
 * - IN: Indiana IT-40 (flat 3.05% + county tax)
 * - KS: Kansas Form K-40 (progressive 3.1%-5.7%)
 * - KY: Kentucky Form 740 (flat 4%)
 * - LA: Louisiana IT-540 (progressive 1.85%-4.25%)
 * - MA: Massachusetts Form 1 (flat 5% + 4% millionaire's tax)
 * - MD: Maryland Form 502 (progressive 2%-5.75% + local tax)
 * - ME: Maine Form 1040ME (progressive 5.8%-7.15%)
 * - MI: Michigan MI-1040 (flat 4.25%)
 * - MN: Minnesota M1 (progressive 5.35%-9.85%)
 * - MO: Missouri MO-1040 (progressive 4.7%-4.8%)
 * - MS: Mississippi Form 80-105 (progressive 0%-4.7%)
 * - MT: Montana Form 2 (progressive 4.7%-5.9%)
 * - NC: North Carolina D-400 (flat 4.5% rate)
 * - ND: North Dakota ND-1 (progressive 1.95%-2.5%)
 * - NE: Nebraska 1040N (progressive 2.46%-5.84%)
 * - NJ: New Jersey NJ-1040 (progressive 1.4%-10.75%)
 * - NM: New Mexico PIT-1 (progressive 1.7%-5.9%)
 * - NY: New York IT-201 (progressive 4%-10.9%)
 * - OH: Ohio IT 1040 (progressive 0%-3.5%)
 * - OK: Oklahoma Form 511 (progressive 0.25%-4.75%)
 * - OR: Oregon Form 40 (progressive 4.75%-9.9%, no sales tax)
 * - PA: Pennsylvania PA-40 (flat 3.07% rate)
 * - RI: Rhode Island RI-1040 (progressive 3.75%-5.99%)
 * - SC: South Carolina SC1040 (progressive 0%-6.4%)
 * - UT: Utah TC-40 (flat 4.65% rate)
 * - VA: Virginia Form 760 (progressive 2%-5.75%)
 * - VT: Vermont IN-111 (progressive 3.35%-8.75%)
 * - WI: Wisconsin Form 1 (progressive 3.54%-7.65%)
 * - WV: West Virginia IT-140 (progressive 2.36%-5.12%)
 */
export const stateForms: {
  [K in State]?: (f1040: F1040) => StateForm
} = {
  AL: makeAL40,
  AR: makeAR1000,
  AZ: makeAZ140,
  CA: makeCA540,
  CO: makeCO104,
  CT: makeCT1040,
  DC: makeDCD40,
  DE: makeDE200_01,
  GA: makeGA500,
  HI: makeHIN11,
  IA: makeIA1040,
  ID: makeID40,
  IL: makeIL1040,
  IN: makeINIT40,
  KS: makeKS40,
  KY: makeKY740,
  LA: makeLAIT540,
  MA: makeMA1,
  MD: makeMD502,
  ME: makeME1040,
  MI: makeMI1040,
  MN: makeMNM1,
  MO: makeMO1040,
  MS: makeMS80105,
  MT: makeMT2,
  NC: makeNCD400,
  ND: makeND1,
  NE: makeNE1040N,
  NJ: makeNJ1040,
  NM: makeNMPIT1,
  NY: makeNYIT201,
  OH: makeOHIT1040,
  OK: makeOK511,
  OR: makeOR40,
  PA: makePA40,
  RI: makeRI1040,
  SC: makeSC1040,
  UT: makeUTTC40,
  VA: makeVA760,
  VT: makeVTIN111,
  WI: makeWI1,
  WV: makeWVIT140
}

export const createStateReturn = (
  f1040: F1040
): Either<StateFormError[], StateForm[]> =>
  createStateReturnF<F1040>(noFilingRequirementStates, stateForms)(f1040)
