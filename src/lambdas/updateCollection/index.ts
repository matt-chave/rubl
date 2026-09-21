/**
 * PUT /movements/{movementId}/collection — correct or tail-peel the latest active event.
 */
import { apiHandler } from '../../lib/http'
import { updateCollection } from '../../lib/operations/collections'

export const handler = apiHandler(updateCollection)
