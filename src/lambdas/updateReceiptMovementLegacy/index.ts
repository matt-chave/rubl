/**
 * PUT /movements/{movementId}/receive — deprecated Phase 1 receipt update.
 * Gateway path param is {movementId} (API Gateway sibling rule); the value
 * is a Phase 1 wasteTrackingId. See api-stack.ts ROUTES comment.
 */
import { apiHandler } from '../../lib/http'
import { updateReceiptMovementLegacy } from '../../lib/operations/receipts'

export const handler = apiHandler(updateReceiptMovementLegacy)
