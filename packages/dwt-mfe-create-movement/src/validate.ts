import type { CreateMovementDraft, FieldIssue, IntendedCarrier, Producer, WasteItem } from './types'

export function validateProducerSlice(producer: Producer | undefined): FieldIssue[] {
  const issues: FieldIssue[] = []
  if (!producer) {
    issues.push({ id: 'wasteSource', message: 'Enter the waste source' })
    return issues
  }
  if (!['Household', 'Commercial', 'Municipal'].includes(producer.wasteSource)) {
    issues.push({ id: 'wasteSource', message: 'Waste source must be Household, Commercial or Municipal' })
  }
  if (producer.wasteSource === 'Commercial' || producer.wasteSource === 'Municipal') {
    if (!producer.organisationName?.trim()) {
      issues.push({ id: 'organisationName', message: 'Enter the producer organisation name' })
    }
    if (!producer.address?.fullAddress?.trim()) {
      issues.push({ id: 'fullAddress', message: 'Enter the producer address' })
    }
    if (!producer.address?.postcode?.trim()) {
      issues.push({ id: 'postcode', message: 'Enter the producer postcode' })
    }
    if (!producer.emailAddress?.trim()) {
      issues.push({ id: 'emailAddress', message: 'Enter the producer email address' })
    }
    if (producer.wasteSource === 'Commercial' && !producer.sicCode?.trim()) {
      issues.push({ id: 'sicCode', message: 'Enter the SIC code for a commercial producer' })
    }
    if (!producer.authorisationNumber?.trim()) {
      issues.push({ id: 'authorisationNumber', message: 'Enter the producer authorisation number' })
    }
  }
  return issues
}

export function validateCarriersSlice(carriers: IntendedCarrier[] | undefined): FieldIssue[] {
  const issues: FieldIssue[] = []
  if (!carriers || carriers.length < 1) {
    issues.push({ id: 'intendedCarriers', message: 'Add at least one intended carrier' })
    return issues
  }
  carriers.forEach((carrier, index) => {
    if (!carrier.meansOfTransport?.trim()) {
      issues.push({ id: `carrier-${index}-meansOfTransport`, message: `Enter the means of transport for carrier ${index + 1}` })
    }
    if (!carrier.organisationName?.trim()) {
      issues.push({ id: `carrier-${index}-organisationName`, message: `Enter the organisation name for carrier ${index + 1}` })
    }
  })
  return issues
}

export function validateWasteItemsSlice(items: WasteItem[] | undefined): FieldIssue[] {
  const issues: FieldIssue[] = []
  if (!items || items.length < 1) {
    issues.push({ id: 'wasteItems', message: 'Add at least one waste item' })
    return issues
  }
  items.forEach((item, index) => {
    const prefix = `waste-${index}`
    if (!item.weight || !(item.weight.amount > 0)) {
      issues.push({ id: `${prefix}-weight`, message: `Enter a weight greater than 0 for waste item ${index + 1}` })
    }
    if (!item.numberOfContainers || item.numberOfContainers < 1) {
      issues.push({ id: `${prefix}-containers`, message: `Enter the number of containers for waste item ${index + 1}` })
    }
    if (!item.typeOfContainers?.trim()) {
      issues.push({ id: `${prefix}-typeOfContainers`, message: `Enter the type of containers for waste item ${index + 1}` })
    }
    if (!item.physicalForm?.trim()) {
      issues.push({ id: `${prefix}-physicalForm`, message: `Enter the physical form for waste item ${index + 1}` })
    }
    if (!item.classification?.ewcCodes?.[0]?.trim()) {
      issues.push({ id: `${prefix}-ewc`, message: `Enter an EWC code for waste item ${index + 1}` })
    }
    if (!item.classification?.wasteDescription?.trim()) {
      issues.push({ id: `${prefix}-description`, message: `Enter a waste description for waste item ${index + 1}` })
    }
    if (!item.intendedTreatments?.[0]?.disposalOrRecoveryCode?.trim()) {
      issues.push({
        id: `${prefix}-treatment`,
        message: `Enter a disposal or recovery code for waste item ${index + 1}`,
      })
    }
  })
  return issues
}

export function validateReviewSlice(draft: CreateMovementDraft): FieldIssue[] {
  const issues: FieldIssue[] = []
  if (!draft.apiCode?.trim()) {
    issues.push({ id: 'apiCode', message: 'Enter the API code (a UUID)' })
  }
  if (!draft.plannedCollectionTime?.trim()) {
    issues.push({ id: 'plannedCollectionTime', message: 'Enter the planned collection date and time' })
  }
  issues.push(...validateProducerSlice(draft.producer))
  issues.push(...validateCarriersSlice(draft.intendedCarriers))
  issues.push(...validateWasteItemsSlice(draft.wasteItems))
  return issues
}

export function assembleCreateMovementBody(draft: CreateMovementDraft): Record<string, unknown> {
  const body: Record<string, unknown> = {
    apiCode: draft.apiCode,
    plannedCollectionTime: draft.plannedCollectionTime,
    producer: draft.producer,
    intendedCarriers: draft.intendedCarriers,
    wasteItems: draft.wasteItems,
  }
  if (draft.movementId) {
    body.movementId = draft.movementId
  }
  return body
}
