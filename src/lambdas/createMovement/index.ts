/**
 * POST /movements — mint a Movement ID, or claim a reserved one.
 *
 * Start of the legal journey. Validate, persist an append-only event, return
 * a speakable public ID. Lake and charging pick the event up from DynamoDB
 * Streams so this handler never waits on them.
 */
import { apiHandler } from '../../lib/http'
import { createMovement } from '../../lib/operations/movements'

export const handler = apiHandler(createMovement)
