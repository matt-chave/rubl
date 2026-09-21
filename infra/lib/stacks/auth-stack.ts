/**
 * AuthStack — the IAM bounded context at the edge.
 *
 * Cognito stands in for Defra identity. Machine-to-machine vendors use the
 * OAuth2 client-credentials grant; API Gateway validates the JWT locally
 * (JWKS) so we never call Cognito per movement. Swap the User Pool for a
 * Defra OIDC issuer later without touching Lambda code.
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

    this.userPool = new cognito.UserPool(this, 'VendorPool', {
      userPoolName: 'dwt-vendor-m2m',
      selfSignUpEnabled: false,
      signInAliases: { username: true },
      // Sandbox: destroy with the stack. Production must RETAIN the pool.
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const movementsScope = new cognito.ResourceServerScope({
      scopeName: 'movements',
      scopeDescription: 'Submit, update and query waste movement records',
    })

    const resourceServer = this.userPool.addResourceServer('DwtApi', {
      identifier: 'dwt',
      userPoolResourceServerName: 'Digital Waste Tracking API',
      scopes: [movementsScope],
    })

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

    // Hosted UI domain is required for the token endpoint even for M2M.
    // Prefix must be globally unique; account+region keeps sandbox deploys apart.
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
