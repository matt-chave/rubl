/**
 * POST /software-providers — onboarding front door for approved software.
 */
import { apiHandler } from '../../lib/http'
import { createSoftwareProvider } from '../../lib/operations/software-providers'

export const handler = apiHandler(createSoftwareProvider)
