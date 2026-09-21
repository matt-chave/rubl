/**
 * POST /receipts — receipt with no prior Movement/Collection/Delivery.
 * Server mints an empty Delivery so the receipt has an addressable ID.
 */
import { apiHandler } from '../../lib/http'
import { recordReceiptWithoutDelivery } from '../../lib/operations/receipts'

export const handler = apiHandler(recordReceiptWithoutDelivery)
