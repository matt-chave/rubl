/**
 * POST /movements/{movementId}/collection — append STATIC then TRANSIT events.
 */
import { apiHandler } from '../../lib/http'
import { recordCollection } from '../../lib/operations/collections'

export const handler = apiHandler(recordCollection)
