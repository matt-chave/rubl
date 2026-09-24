/**
 * POST /id-reservations — reserve year-prefixed sqids for offline vendors.
 * This is not a waste event, so the lake and charging do not see this write.
 */
import { apiHandler } from '../../lib/http'
import { reserveIds } from '../../lib/operations/reservations'

export const handler = apiHandler(reserveIds)
