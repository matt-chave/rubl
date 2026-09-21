/**
 * Structural checks for Phase 2 receipt, POST /receipts, and Phase 1 legacy.
 */

import type { ValidationIssue } from '../../types'
import { validateFullCarrier, validateReceiverSite } from '../parties'
import { requireArray, requireDateTime, requireFields, requireUuid } from '../primitives'

export function validateReceiptPayload(body: Record<string, unknown>, issues: ValidationIssue[]): void {
  requireFields(body, ['apiCode', 'dateTimeReceived', 'carrier', 'wasteItems', 'receiverSite'], issues)
  requireUuid(body, 'apiCode', issues)
  requireDateTime(body, 'dateTimeReceived', issues)
  validateFullCarrier(body.carrier, 'carrier', issues, true)
  requireArray(body, 'wasteItems', 1, issues)
  validateReceiverSite(body.receiverSite, issues)
}

export function validateReceiptWithoutDeliveryPayload(body: Record<string, unknown>, issues: ValidationIssue[]): void {
  requireFields(body, ['apiCode', 'dateTimeReceived', 'carrier', 'wasteItems', 'receiverSite', 'reasonForNoDeliveryId'], issues)
  requireUuid(body, 'apiCode', issues)
  requireDateTime(body, 'dateTimeReceived', issues)
  validateFullCarrier(body.carrier, 'carrier', issues, true)
  requireArray(body, 'wasteItems', 1, issues)
}
