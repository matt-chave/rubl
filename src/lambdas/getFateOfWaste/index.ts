/**
 * GET /movements/{movementId}/fate-of-waste — producer-facing status summary.
 */
import { apiHandler } from '../../lib/http'
import { getFateOfWaste } from '../../lib/operations/fate-of-waste'

export const handler = apiHandler(getFateOfWaste)
