/**
 * PUT /movements/{wasteTrackingId}/receive — deprecated Phase 1 receipt update.
 */
import { apiHandler } from '../../lib/http'
import { updateReceiptMovementLegacy } from '../../lib/operations/receipts'

export const handler = apiHandler(updateReceiptMovementLegacy)
