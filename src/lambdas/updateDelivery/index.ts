/**
 * PUT /deliveries/{deliveryId} — soft-delete or restore only.
 */
import { apiHandler } from '../../lib/http'
import { updateDelivery } from '../../lib/operations/deliveries'

export const handler = apiHandler(updateDelivery)
