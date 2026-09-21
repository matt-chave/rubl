/** GET /reference-data/ewc-codes */
import { apiHandler } from '../../lib/http'
import { listEwcCodes } from '../../lib/operations/reference-data'

export const handler = apiHandler(listEwcCodes)
