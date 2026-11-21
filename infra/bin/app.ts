import * as cdk from 'aws-cdk-lib';
import { GkShoppyStack } from '../lib/gkshoppy-stack';

const app = new cdk.App();
const config = app.node.tryGetContext('config') as string | undefined;
new GkShoppyStack(app, 'GkShoppyStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  configPath: config,
});

app.synth();
