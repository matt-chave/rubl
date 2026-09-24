/**
 * POST /operators — onboarding front door for waste operators.
 */
import { apiHandler } from '../../lib/http'
import { createOperator } from '../../lib/operations/operators'

export const handler = apiHandler(createOperator)
