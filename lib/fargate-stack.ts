import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elb2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';



export interface IFargateContruct extends StackProps {
  clientName: string;
  domain: string;
  clusterName: string;
  repositoryName: string;
  clientPrefix: string;
  environment:{ [key: string]: string } | undefined;
}


export class FargateStack extends Stack {
  
  constructor(scope: Construct, id: string, props: IFargateContruct) {
    super(scope, id, props);

    const {clusterName, clientName, repositoryName, clientPrefix, environment} = props;

    const vpc = new ec2.Vpc(this, "ApplicationVpc", { maxAzs: 2 });

    const cluster = new ecs.Cluster(this, "Cluster", {
      clusterName,
      vpc,
    });

    const repository = new ecr.Repository(this, `${clientName}-repository`, {
      repositoryName
    });

    // load balancer resources
    const elb = new elb2.ApplicationLoadBalancer(
      this,
      `${clientPrefix}-elb`,
      {
        vpc,
        vpcSubnets: { subnets: vpc.publicSubnets },
        internetFacing: true,
      }
    );


   
   

    const targetGroupHttp = new elb2.ApplicationTargetGroup(
      this,
      `${clientPrefix}-target`,
      {
        port: 80,
        vpc,
        protocol: elb2.ApplicationProtocol.HTTP,
        targetType: elb2.TargetType.IP,
      }
    );


    targetGroupHttp.configureHealthCheck({
      path: "/",
      protocol: elb2.Protocol.HTTP,
    });

    

    const listener = elb.addListener("Listener", {
      open: true,
      port: 80,
    });

    listener.addTargetGroups(`${clientPrefix}-tg`, {
      targetGroups: [targetGroupHttp],
    });

    const elbSG = new ec2.SecurityGroup(this, `${clientPrefix}-elbSG`, {
      vpc,
      allowAllOutbound: true,
    });

    elbSG.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow http traffic"
    );

    elb.addSecurityGroup(elbSG);



    const bucket = new s3.Bucket(this, `${clientPrefix}-s3-bucket`, {
      bucketName: `${clientName}-${clientPrefix}-assets`,
    });

    const taskRole = new iam.Role(this, `${clientPrefix}-task-role`, {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      roleName: `${clientPrefix}-task-role`,
      description: "Role that the api task definitions use to run the api code",
    });

    taskRole.attachInlinePolicy(
      new iam.Policy(this, `${clientPrefix}-task-policy`, {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["S3:*"],
            resources: [bucket.bucketArn],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["SES:*"],
            resources: ["*"],
          }),
        ],
      })
    );

    const taskDefinition = new ecs.TaskDefinition(
      this,
      `${clientPrefix}-task`,
      {
        family: `${clientPrefix}-task`,
        compatibility: ecs.Compatibility.EC2_AND_FARGATE,
        cpu: "256",
        memoryMiB: "512",
        networkMode: ecs.NetworkMode.AWS_VPC,
        taskRole: taskRole,
      }
    );

    const image = ecs.RepositoryImage.fromRegistry('ghcr.io/mokeseven7/fargate:main',);

    const container = taskDefinition.addContainer(`${clientPrefix}-container`, {
      image,
      memoryLimitMiB: 512,
      environment,
      logging: ecs.LogDriver.awsLogs({ streamPrefix: clientPrefix }),
    });

    container.addPortMappings({ containerPort: 80 });

    const ecsSG = new ec2.SecurityGroup(this, `${clientPrefix}-ecsSG`, {
      vpc,
      allowAllOutbound: true,
    });

    ecsSG.connections.allowFrom(
      elbSG,
      ec2.Port.allTcp(),
      "Application load balancer"
    );


    const service = new ecs.FargateService(this, `${clientPrefix}-service`, {
      cluster,
      desiredCount: 1,
      taskDefinition,
      securityGroups: [ecsSG],
      assignPublicIp: true,
    });

    service.attachToApplicationTargetGroup(targetGroupHttp);

    const scalableTaget = service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 5,
    });

    scalableTaget.scaleOnMemoryUtilization(`${clientPrefix}-ScaleUpMem`, {
      targetUtilizationPercent: 75,
    });

    scalableTaget.scaleOnCpuUtilization(`${clientPrefix}-ScaleUpCPU`, {
      targetUtilizationPercent: 75,
    });

    // outputs to be used in code deployments
    new CfnOutput(this, `ServiceName`, {
      exportName: `ServiceName`,
      value: service.serviceName,
    });

    new CfnOutput(this, `ImageRepositoryUri`, {
      exportName: `ImageRepositoryUri`,
      value: repository.repositoryUri,
    });

   

    new CfnOutput(this, `ClusterName`, {
      exportName: `ClusterName`,
      value: cluster.clusterName,
    });

  }
}
