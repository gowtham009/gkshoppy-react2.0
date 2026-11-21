import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as customResources from 'aws-cdk-lib/custom-resources';

interface GkShoppyStackProps extends cdk.StackProps {
  configPath?: string;
}

interface GkShoppyConfig {
  region: string;
  database: {
    identifier: string;
    displayName: string;
  };
  llm: {
    modelId: string;
  };
}

export class GkShoppyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GkShoppyStackProps) {
    super(scope, id, props);

    const configFile = props.configPath
      ? path.resolve(process.cwd(), props.configPath)
      : path.join(__dirname, '../config/aws-config.json');
    const config = this.readConfig(configFile);
    const region = this.region || config.region;

    const vpc = new ec2.Vpc(this, 'ApplicationVpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'ApiSecurityGroup', {
      vpc,
      description: 'Network access for GK Shoppy API Lambda',
      allowAllOutbound: true,
    });
    const databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc,
      description: 'PostgreSQL access from the GK Shoppy API only',
      allowAllOutbound: false,
    });
    databaseSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL connections from the API Lambda',
    );

    const endpointSecurityGroup = new ec2.SecurityGroup(this, 'EndpointSecurityGroup', {
      vpc,
      description: 'HTTPS access to AWS service endpoints from the API Lambda',
      allowAllOutbound: false,
    });
    endpointSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(443),
      'Allow HTTPS from the API Lambda',
    );
    vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      securityGroups: [endpointSecurityGroup],
      subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });
    vpc.addInterfaceEndpoint('BedrockRuntimeEndpoint', {
      service: new ec2.InterfaceVpcEndpointService(
        `com.amazonaws.${region}.bedrock-runtime`,
        443,
      ),
      securityGroups: [endpointSecurityGroup],
      subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    const database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_4,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MICRO,
      ),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [databaseSecurityGroup],
      databaseName: config.database.identifier,
      credentials: rds.Credentials.fromGeneratedSecret('gkshoppyadmin'),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      publiclyAccessible: false,
      backupRetention: cdk.Duration.days(7),
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoMinorVersionUpgrade: true,
    });
    const databaseSecret = database.secret;
    if (!databaseSecret) {
      throw new Error('RDS did not create its expected Secrets Manager secret.');
    }

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'GKShoppyUsers',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        preferredUsername: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const userPoolClient = userPool.addClient('WebClient', {
      authFlows: { userPassword: true },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    const apiFunction = new nodejs.NodejsFunction(this, 'ApiFunction', {
      entry: path.join(__dirname, '../lambda/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [lambdaSecurityGroup],
      environment: {
        DB_HOST: database.instanceEndpoint.hostname,
        DB_NAME: config.database.identifier,
        DB_SECRET_ARN: databaseSecret.secretArn,
        BEDROCK_MODEL_ID: config.llm.modelId,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      bundling: {
        nodeModules: ['pg'],
      },
    });
    databaseSecret.grantRead(apiFunction);
    apiFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:${region}::foundation-model/${config.llm.modelId}`,
        ],
      }),
    );

    const schemaFunction = new nodejs.NodejsFunction(this, 'SchemaFunction', {
      entry: path.join(__dirname, '../lambda/schema-resource.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: cdk.Duration.minutes(2),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [lambdaSecurityGroup],
      environment: {
        DB_HOST: database.instanceEndpoint.hostname,
        DB_NAME: config.database.identifier,
        DB_SECRET_ARN: databaseSecret.secretArn,
      },
      bundling: {
        nodeModules: ['pg'],
        loader: { '.sql': 'text' },
      },
    });
    databaseSecret.grantRead(schemaFunction);
    const schemaProvider = new customResources.Provider(this, 'SchemaProvider', {
      onEventHandler: schemaFunction,
    });
    new cdk.CustomResource(this, 'DatabaseSchema', {
      serviceToken: schemaProvider.serviceToken,
      properties: { SchemaVersion: '1' },
    });

    const api = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: 'GKShoppyApi',
      corsPreflight: {
        allowHeaders: ['authorization', 'content-type'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.PATCH,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
        maxAge: cdk.Duration.hours(1),
      },
    });
    const jwtAuthorizer = new authorizers.HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.${region}.amazonaws.com/${userPool.userPoolId}`,
      { jwtAudience: [userPoolClient.userPoolClientId] },
    );
    const integration = new integrations.HttpLambdaIntegration(
      'ApiIntegration',
      apiFunction,
    );
    const addRoute = (
      pathValue: string,
      methods: apigatewayv2.HttpMethod[],
      authenticated = true,
    ) => {
      api.addRoutes({
        path: pathValue,
        methods,
        integration,
        ...(authenticated ? { authorizer: jwtAuthorizer } : {}),
      });
    };

    addRoute('/products', [apigatewayv2.HttpMethod.GET], false);
    addRoute('/profile', [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.PUT]);
    addRoute('/cart', [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.DELETE]);
    addRoute('/cart/items', [apigatewayv2.HttpMethod.POST]);
    addRoute('/cart/items/{id}', [
      apigatewayv2.HttpMethod.PATCH,
      apigatewayv2.HttpMethod.DELETE,
    ]);
    addRoute('/orders', [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST]);
    addRoute('/chat', [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST]);
    addRoute('/chat/{id}', [apigatewayv2.HttpMethod.DELETE]);

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.instanceEndpoint.hostname,
    });
    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: databaseSecret.secretArn,
    });
    new cdk.CfnOutput(this, 'ApiFunctionName', {
      value: apiFunction.functionName,
    });
    new cdk.CfnOutput(this, 'DatabaseName', {
      value: config.database.displayName,
    });
  }

  private readConfig(filePath: string): GkShoppyConfig {
    const raw = readFileSync(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('region' in parsed) ||
      !('database' in parsed) ||
      !('llm' in parsed)
    ) {
      throw new Error(`Invalid GK Shoppy AWS configuration: ${filePath}`);
    }
    return parsed as GkShoppyConfig;
  }
}
