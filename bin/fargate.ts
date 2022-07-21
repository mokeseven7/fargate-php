#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FargateStack } from '../lib/fargate-construct';

const app = new cdk.App();
new FargateStack(app, 'FargateStack', {
  clientName: 'hello',
  environment: {
    APPENV: 'hello'
  },
  domain: 'nada',
  clusterName: 'mycluster',
  repositoryName: 'mokeseven7/fargate',
  clientPrefix: "fargatephp",
  
});