var __create = Object.create;
var __defProp = Object.defineProperty;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {get: all[name], enumerable: true});
};
var __reExport = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, {get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable});
  }
  return target;
};
var __toModule = (module2) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? {get: () => module2.default, enumerable: true} : {value: module2, enumerable: true})), module2);
};
__markAsModule(exports);
__export(exports, {
  QUEUE_DEFINITION: () => QUEUE_DEFINITION,
  Queue: () => Queue
});
var import_aws_sqs = __toModule(require("@aws-cdk/aws-sqs"));
var import_aws_cloudwatch = __toModule(require("@aws-cdk/aws-cloudwatch"));
var import_aws_sns = __toModule(require("@aws-cdk/aws-sns"));
var import_core = __toModule(require("@aws-cdk/core"));
var import_Stack = __toModule(require("../Stack"));
const QUEUE_DEFINITION = {
  type: "object",
  properties: {
    type: {const: "queue"},
    worker: {
      type: "object",
      properties: {
        handler: {type: "string"},
        timeout: {type: "number"}
      },
      required: ["handler"],
      additionalProperties: true
    },
    maxRetries: {type: "number"},
    alarm: {type: "string"},
    batchSize: {
      type: "number",
      minimum: 1,
      maximum: 10
    }
  },
  additionalProperties: false,
  required: ["worker"]
};
class Queue extends import_core.Construct {
  constructor(scope, id, configuration, provider) {
    super(scope, id);
    this.id = id;
    this.configuration = configuration;
    this.provider = provider;
    var _a, _b;
    const functionTimeout = (_a = configuration.worker.timeout) != null ? _a : 6;
    const maxRetries = (_b = configuration.maxRetries) != null ? _b : 3;
    const dlq = new import_aws_sqs.Queue(this, "Dlq", {
      queueName: `${this.provider.stackName}-${id}-dlq`,
      retentionPeriod: import_core.Duration.days(14)
    });
    this.queue = new import_aws_sqs.Queue(this, "Queue", {
      queueName: `${this.provider.stackName}-${id}`,
      visibilityTimeout: import_core.Duration.seconds(functionTimeout * 6),
      deadLetterQueue: {
        maxReceiveCount: maxRetries,
        queue: dlq
      }
    });
    const alarmEmail = configuration.alarm;
    if (alarmEmail !== void 0) {
      const alarmTopic = new import_aws_sns.Topic(this, "AlarmTopic", {
        topicName: `${this.provider.stackName}-${id}-dlq-alarm-topic`,
        displayName: `[Alert][${id}] There are failed jobs in the dead letter queue.`
      });
      new import_aws_sns.Subscription(this, "AlarmTopicSubscription", {
        topic: alarmTopic,
        protocol: import_aws_sns.SubscriptionProtocol.EMAIL,
        endpoint: alarmEmail
      });
      const alarm = new import_aws_cloudwatch.Alarm(this, "Alarm", {
        alarmName: `${this.provider.stackName}-${id}-dlq-alarm`,
        alarmDescription: "Alert triggered when there are failed jobs in the dead letter queue.",
        metric: new import_aws_cloudwatch.Metric({
          namespace: "AWS/SQS",
          metricName: "ApproximateNumberOfMessagesVisible",
          dimensions: {
            QueueName: dlq.queueName
          },
          statistic: "Sum",
          period: import_core.Duration.minutes(1)
        }),
        evaluationPeriods: 1,
        threshold: 0,
        comparisonOperator: import_aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
      });
      alarm.addAlarmAction({
        bind() {
          return {alarmActionArn: alarmTopic.topicArn};
        }
      });
    }
    this.queueArnOutput = new import_core.CfnOutput(this, "QueueArn", {
      description: `ARN of the "${id}" SQS queue.`,
      value: this.queue.queueArn
    });
    this.queueUrlOutput = new import_core.CfnOutput(this, "QueueUrl", {
      description: `URL of the "${id}" SQS queue.`,
      value: this.queue.queueUrl
    });
    this.dlqUrlOutput = new import_core.CfnOutput(this, "DlqUrl", {
      description: `URL of the "${id}" SQS Dead Letter Queue.`,
      value: dlq.queueUrl
    });
    this.appendFunctions();
  }
  commands() {
    return {};
  }
  outputs() {
    return {
      queueUrl: () => this.getQueueUrl()
    };
  }
  references() {
    return {
      queueUrl: this.referenceQueueUrl(),
      queueArn: this.referenceQueueArn()
    };
  }
  permissions() {
    return [new import_Stack.PolicyStatement("sqs:SendMessage", [this.referenceQueueArn()])];
  }
  appendFunctions() {
    var _a;
    const batchSize = (_a = this.configuration.batchSize) != null ? _a : 1;
    this.configuration.worker.events = [
      {
        sqs: {
          arn: this.referenceQueueArn(),
          batchSize,
          maximumBatchingWindow: 60
        }
      }
    ];
    this.provider.addFunction(`${this.id}Worker`, this.configuration.worker);
  }
  referenceQueueArn() {
    return this.provider.getCloudFormationReference(this.queue.queueArn);
  }
  referenceQueueUrl() {
    return this.provider.getCloudFormationReference(this.queue.queueUrl);
  }
  async getQueueUrl() {
    return this.provider.getStackOutput(this.queueUrlOutput);
  }
  async getDlqUrl() {
    return this.provider.getStackOutput(this.dlqUrlOutput);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  QUEUE_DEFINITION,
  Queue
});
//# sourceMappingURL=Queue.js.map
