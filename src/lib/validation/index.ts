/**
 * Payload validation entry point.
 *
 * Domain shapes live in sibling modules; each endpoint family has a thin
 * composer under operations/. Callers keep importing validateOperation from
 * this file so a later AJV compiler can replace the switch without touching
 * Lambdas.
 *
 * Cross-field lifecycle rules (deleted movement, closed collection sequence)
 * stay in rules.ts — OpenAPI 3.0 cannot express them.
 */

import { ValidationError } from '../errors'
import type { ValidationIssue } from '../types'
import { validateCollectionPayload } from './operations/collections'
import { validateRecordDeliveryPayload, validateUpdateDeliveryPayload } from './operations/deliveries'
import { validateMovementPayload } from './operations/movements'
import { validateReceiptPayload, validateReceiptWithoutDeliveryPayload } from './operations/receipts'
import type { ValidatedBody } from './types'
import { collectWasteItemWarnings } from './waste-item'

export type { ValidatedBody } from './types'
export { isIsoDateTime, isUuid } from './primitives'
export { movementIsHazardous } from './waste-item'

export function validateOperation(operationId: string, body: Record<string, unknown>): ValidatedBody {
  const issues: ValidationIssue[] = []

  switch (operationId) {
    case 'createMovement':
    case 'updateMovement':
      validateMovementPayload(body, issues)
      break
    case 'recordCollection':
    case 'updateCollection':
      validateCollectionPayload(body, issues)
      break
    case 'recordDelivery':
      validateRecordDeliveryPayload(body, issues)
      break
    case 'updateDelivery':
      validateUpdateDeliveryPayload(body, issues)
      break
    case 'recordReceipt':
    case 'updateReceipt':
    case 'createReceiptMovementLegacy':
    case 'updateReceiptMovementLegacy':
      validateReceiptPayload(body, issues)
      break
    case 'recordReceiptWithoutDelivery':
      validateReceiptWithoutDeliveryPayload(body, issues)
      break
    default:
      break
  }

  if (issues.length > 0) {
    throw new ValidationError(issues)
  }

  return { body, warnings: collectWasteItemWarnings(body) }
}
