/** GET /reference-data/hazardous-property-codes */
import { apiHandler } from '../../lib/http'
import { listHazardousPropertyCodes } from '../../lib/operations/reference-data'

export const handler = apiHandler(listHazardousPropertyCodes)
