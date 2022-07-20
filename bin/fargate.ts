#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FargateConstruct } from '../lib/fargate-construct';

const app = new cdk.App();
new FargateConstruct(app, 'FargateStack', {
  clientName: 'hello',
  environment: {
    APP_ENV: 'hello'
  },
  domain: 'nada',
  clusterName: 'mycluster',
  repositoryName: 'mokeseven7/fargate',
  clientPrefix: "fargatephp",
  
});