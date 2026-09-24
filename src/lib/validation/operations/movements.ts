/**
 * Structural checks for POST/PUT /movements.
 * Lifecycle rules (soft-delete after collection) stay in rules.ts.
 */

import { issue } from '../../errors'
import type { ValidationIssue } from '../../types'
import { validateIntendedCarrier, validateProducer } from '../parties'
import { requireArray, requireDateTime, requireFields, requireUuid } from '../primitives'
import { validateCreateWasteItem } from '../waste-item'

export function validateMovementPayload(body: Record<string, unknown>, issues: ValidationIssue[]): void {
  requireFields(body, ['apiCode', 'plannedCollectionTime', 'producer', 'intendedCarriers', 'wasteItems'], issues)
  requireUuid(body, 'apiCode', issues)
  requireDateTime(body, 'plannedCollectionTime', issues)
  requireArray(body, 'intendedCarriers', 1, issues)
  requireArray(body, 'wasteItems', 1, issues)
  validateProducer(body.producer, issues)
  if (Array.isArray(body.intendedCarriers)) {
    body.intendedCarriers.forEach((c, i) => {
      if (c && typeof c === 'object') {
        validateIntendedCarrier(c as Record<string, unknown>, `intendedCarriers[${i}]`, issues)
      }
    })
  }
  if (Array.isArray(body.wasteItems)) {
    body.wasteItems.forEach((item, i) => validateCreateWasteItem(item, `wasteItems[${i}]`, issues))
  }
  if (body.collectionAddressDifferentFromProducer === true && !body.collectionSite) {
    issues.push(issue('collectionSite', 'NotProvided', 'collectionSite is required when collectionAddressDifferentFromProducer is true'))
  }
  if (body.collectionAddressDifferentFromProducer !== true && body.collectionSite) {
    issues.push(issue('collectionSite', 'NotAllowed', 'collectionSite must not be provided unless collectionAddressDifferentFromProducer is true'))
  }
  if (body.movementId !== undefined && (typeof body.movementId !== 'string' || body.movementId.length === 0)) {
    issues.push(issue('movementId', 'InvalidType', 'movementId must be a non-empty string'))
  }
}
