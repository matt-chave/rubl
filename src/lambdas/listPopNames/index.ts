/** GET /reference-data/pop-names */
import { apiHandler } from '../../lib/http'
import { listPopNames } from '../../lib/operations/reference-data'

export const handler = apiHandler(listPopNames)
