import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as Fargate from '../lib/fargate-stack';

// example test. To run these tests, uncomment this file along with the
// example resource in lib/fargate-stack.ts
test('ECR Repository Created', () => {
  const app = new cdk.App();

  const config = {
    clientName: 'testclient',
    environment: {
    APPENV: 'test'
    },
    domain: 'nada',
    clusterName: 'testcluster',
    repositoryName: 'mokeseven7/fargate',
    clientPrefix: "testfargate",
  }

  const stack = new Fargate.FargateStack(app, 'MyTestStack', config);
    // THEN
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::ECR::Repository', {
    RepositoryName: config.repositoryName
  });
});
