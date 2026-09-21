/**
 * PUT /movements/{movementId} — revise or soft-delete a movement.
 *
 * Snapshots the live record to history first so a PUT cannot silently
 * overwrite the legal trail.
 */
import { apiHandler } from '../../lib/http'
import { updateMovement } from '../../lib/operations/movements'

export const handler = apiHandler(updateMovement)
