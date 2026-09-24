/**
 * Structural checks for POST /deliveries and PUT /deliveries/{deliveryId}.
 * PUT accepts only apiCode + isDeleted — a recorded delivery is immutable.
 */

import { issue } from '../../errors'
import type { ValidationIssue } from '../../types'
import { validateDeliverySite, validateFullCarrier } from '../parties'
import { requireArray, requireDateTime, requireFields, requireUuid } from '../primitives'

export function validateRecordDeliveryPayload(body: Record<string, unknown>, issues: ValidationIssue[]): void {
  requireFields(body, ['apiCode', 'movementIds', 'actualDateTimeDelivered', 'carrier', 'deliverySite'], issues)
  requireUuid(body, 'apiCode', issues)
  requireDateTime(body, 'actualDateTimeDelivered', issues)
  requireArray(body, 'movementIds', 1, issues)
  validateFullCarrier(body.carrier, 'carrier', issues, true)
  validateDeliverySite(body.deliverySite, issues)
  if (body.deliveryId !== undefined && (typeof body.deliveryId !== 'string' || body.deliveryId.length === 0)) {
    issues.push(issue('deliveryId', 'InvalidType', 'deliveryId must be a non-empty string'))
  }
}

export function validateUpdateDeliveryPayload(body: Record<string, unknown>, issues: ValidationIssue[]): void {
  requireFields(body, ['apiCode', 'isDeleted'], issues)
  requireUuid(body, 'apiCode', issues)
  if (typeof body.isDeleted !== 'boolean' && body.isDeleted !== undefined) {
    issues.push(issue('isDeleted', 'InvalidType', 'isDeleted must be a boolean'))
  }
  for (const key of Object.keys(body)) {
    if (key !== 'apiCode' && key !== 'isDeleted') {
      issues.push(issue(key, 'NotAllowed', `${key} cannot be changed on a recorded delivery`))
    }
  }
}
