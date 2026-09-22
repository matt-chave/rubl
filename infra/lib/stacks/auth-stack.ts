/**
 * AuthStack — the IAM bounded context at the edge (CDK stack id: DwtAuth).
 *
 * `cdk deploy DwtAuth` *creates* this User Pool. Do not click Create user
 * pool (or Create user) in the Cognito console first — the list should be
 * empty until this stack succeeds.
 *
 * There are no human Cognito users here. A vendor is an app client
 * (`client_id` + `client_secret`) using the OAuth2 client-credentials grant.
 * API Gateway later checks the JWT locally (JWKS). Swap this pool for a
 * Defra OIDC issuer without touching Lambda code.
 *
 * Human UI login (GOV.UK One Login) is out of scope for this slice.
 */

import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import { Construct } from 'constructs'

export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool
  public readonly userPoolClient: cognito.UserPoolClient
  public readonly domain: cognito.UserPoolDomain

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // The *type*: one pool for machine vendors, not a list of companies.
    // selfSignUpEnabled is false: we are not onboarding people.
    this.userPool = new cognito.UserPool(this, 'VendorPool', {
      userPoolName: 'dwt-vendor-m2m',
      selfSignUpEnabled: false,
      signInAliases: { username: true },
      // Sandbox: destroy with the stack. Production must RETAIN the pool.
      removalPolicy: RemovalPolicy.DESTROY,
    })

    // Custom scope on the access token: `dwt/movements` (identifier/scopeName).
    const movementsScope = new cognito.ResourceServerScope({
      scopeName: 'movements',
      scopeDescription: 'Submit, update and query waste movement records',
    })

    const resourceServer = this.userPool.addResourceServer('DwtApi', {
      identifier: 'dwt',
      userPoolResourceServerName: 'Digital Waste Tracking API',
      scopes: [movementsScope],
    })

    // One *instance* so this workshop can get a token. Do not treat this as
    // the production onboarding path: a new vendor must not require
    // `cdk deploy DwtAuth`. IAM would CreateUserPoolClient (often after a
    // DevEx conformance event). Not a username. Console: App clients.
    this.userPoolClient = this.userPool.addClient('VendorM2m', {
      userPoolClientName: 'dwt-vendor-software',
      generateSecret: true,
      oAuth: {
        flows: { clientCredentials: true },
        scopes: [cognito.OAuthScope.resourceServer(resourceServer, movementsScope)],
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
    })
    this.userPoolClient.node.addDependency(resourceServer)

    // Hosted UI domain is required for /oauth2/token even with no login page.
    // Prefix must be globally unique; account id keeps sandbox deploys apart.
    const prefix = `dwt${this.account}`.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 63)
    this.domain = this.userPool.addDomain('Domain', {
      cognitoDomain: { domainPrefix: prefix || 'dwtmovements' },
    })

    new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId })
    new CfnOutput(this, 'ClientId', { value: this.userPoolClient.userPoolClientId })
    new CfnOutput(this, 'TokenUrl', {
      value: `https://${this.domain.domainName}.auth.${this.region}.amazoncognito.com/oauth2/token`,
    })
    new CfnOutput(this, 'OAuthScope', { value: 'dwt/movements' })
    new CfnOutput(this, 'ClientSecretNote', {
      value: 'Copy the client secret from Cognito → App client. Do not commit it.',
    })
  }
}
