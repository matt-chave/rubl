/**
 * POST /deliveries — mint Delivery IDs (hazardous deliveries reuse the Movement ID).
 */
import { apiHandler } from '../../lib/http'
import { recordDelivery } from '../../lib/operations/deliveries'

export const handler = apiHandler(recordDelivery)
