/** GET /reference-data/disposal-or-recovery-codes */
import { apiHandler } from '../../lib/http'
import { listDisposalOrRecoveryCodes } from '../../lib/operations/reference-data'

export const handler = apiHandler(listDisposalOrRecoveryCodes)
