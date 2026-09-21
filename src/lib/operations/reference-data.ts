/**
 * Reference-data GET handlers.
 *
 * Taxonomy changes on a legislative cycle, not a 5pm ingestion spike, so
 * these Lambdas serve a bundled snapshot rather than hitting the movements
 * ledger. A DynamoDB reference table exists in LedgerStack for a later
 * seed/load if the catalogue must be updated without a redeploy.
 */

import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { HandlerResult } from '../http'
import ewc from '../../../data/reference/ewc-codes.json'
import haz from '../../../data/reference/hazardous-property-codes.json'
import recovery from '../../../data/reference/disposal-or-recovery-codes.json'
import containers from '../../../data/reference/container-types.json'
import pops from '../../../data/reference/pop-names.json'

export async function listEwcCodes(
  _event: APIGatewayProxyEvent,
  _body: Record<string, unknown>,
): Promise<HandlerResult> {
  return { statusCode: 200, body: ewc }
}

export async function listHazardousPropertyCodes(
  _event: APIGatewayProxyEvent,
  _body: Record<string, unknown>,
): Promise<HandlerResult> {
  return { statusCode: 200, body: haz }
}

export async function listDisposalOrRecoveryCodes(
  _event: APIGatewayProxyEvent,
  _body: Record<string, unknown>,
): Promise<HandlerResult> {
  return { statusCode: 200, body: recovery }
}

export async function listContainerTypes(
  _event: APIGatewayProxyEvent,
  _body: Record<string, unknown>,
): Promise<HandlerResult> {
  return { statusCode: 200, body: containers }
}

export async function listPopNames(
  _event: APIGatewayProxyEvent,
  _body: Record<string, unknown>,
): Promise<HandlerResult> {
  return { statusCode: 200, body: pops }
}
