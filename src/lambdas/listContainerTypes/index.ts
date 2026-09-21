/** GET /reference-data/container-types */
import { apiHandler } from '../../lib/http'
import { listContainerTypes } from '../../lib/operations/reference-data'

export const handler = apiHandler(listContainerTypes)
