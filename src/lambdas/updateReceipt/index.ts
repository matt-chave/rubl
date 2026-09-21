/**
 * PUT /deliveries/{deliveryId}/receipt — snapshot then revise a recorded receipt.
 */
import { apiHandler } from '../../lib/http'
import { updateReceipt } from '../../lib/operations/receipts'

export const handler = apiHandler(updateReceipt)
