/**
 * Structural checks for POST/PUT /movements/{movementId}/collection.
 * Sequence rules (STATIC then TRANSIT, closed after delivery) stay in rules.ts.
 */

import { issue } from '../../errors'
import type { ValidationIssue } from '../../types'
import { validateFullCarrier } from '../parties'
import { requireDateTime, requireFields, requireUuid } from '../primitives'

export function validateCollectionPayload(body: Record<string, unknown>, issues: ValidationIssue[]): void {
  requireFields(body, ['apiCode', 'actualDateTimeCollected', 'carrier', 'dutyOfCareConfirmed', 'collectionSite'], issues)
  requireUuid(body, 'apiCode', issues)
  requireDateTime(body, 'actualDateTimeCollected', issues)
  validateFullCarrier(body.carrier, 'carrier', issues, true)
  if (body.collectionType === 'TRANSIT') {
    validateFullCarrier(body.receivedFromCarrier, 'receivedFromCarrier', issues, true)
  }
  if ((body.collectionType === 'STATIC' || body.collectionType === undefined) && body.receivedFromCarrier) {
    issues.push(issue('receivedFromCarrier', 'NotAllowed', 'receivedFromCarrier must not be provided on a STATIC collection'))
  }
}
