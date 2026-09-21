/**
 * POST /deliveries/{deliveryId}/receipt — terminal receipt against a Delivery.
 */
import { apiHandler } from '../../lib/http'
import { recordReceipt } from '../../lib/operations/receipts'

export const handler = apiHandler(recordReceipt)
