/**
 * POST /movements/receive — deprecated Phase 1 receipt. Prefer POST /deliveries/{id}/receipt.
 */
import { apiHandler } from '../../lib/http'
import { createReceiptMovementLegacy } from '../../lib/operations/receipts'

export const handler = apiHandler(createReceiptMovementLegacy)
