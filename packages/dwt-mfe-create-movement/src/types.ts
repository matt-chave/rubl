export interface Address {
  fullAddress: string
  postcode: string
}

export interface Producer {
  wasteSource: 'Household' | 'Commercial' | 'Municipal' | ''
  organisationName?: string
  sicCode?: string
  authorisationNumber?: string
  emailAddress?: string
  address?: Address
}

export interface IntendedCarrier {
  meansOfTransport: string
  organisationName: string
  emailAddress?: string
}

export interface Weight {
  metric: 'Tonnes' | 'Kilograms'
  amount: number
  isEstimate: boolean
}

export interface WasteItem {
  weight: Weight
  numberOfContainers: number
  typeOfContainers: string
  physicalForm: string
  classification: {
    ewcCodes: string[]
    wasteDescription: string
    containsPops: boolean
    containsHazardous: boolean
  }
  intendedTreatments: {
    disposalOrRecoveryCode: string
    weight: Weight
  }[]
}

export interface CreateMovementDraft {
  apiCode?: string
  plannedCollectionTime?: string
  movementId?: string
  producer?: Producer
  intendedCarriers?: IntendedCarrier[]
  wasteItems?: WasteItem[]
}

export interface FieldIssue {
  id: string
  message: string
}

export const EMPTY_PRODUCER: Producer = {
  wasteSource: 'Commercial',
  organisationName: '',
  sicCode: '',
  authorisationNumber: '',
  emailAddress: '',
  address: { fullAddress: '', postcode: '' },
}

export const EMPTY_CARRIER: IntendedCarrier = {
  meansOfTransport: 'Road',
  organisationName: '',
  emailAddress: '',
}

export const EMPTY_WASTE_ITEM: WasteItem = {
  weight: { metric: 'Tonnes', amount: 0, isEstimate: true },
  numberOfContainers: 1,
  typeOfContainers: 'SKI',
  physicalForm: 'Solid',
  classification: {
    ewcCodes: [''],
    wasteDescription: '',
    containsPops: false,
    containsHazardous: false,
  },
  intendedTreatments: [
    {
      disposalOrRecoveryCode: 'R3',
      weight: { metric: 'Tonnes', amount: 0, isEstimate: true },
    },
  ],
}
