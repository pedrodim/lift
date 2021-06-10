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
  WEBHOOK_DEFINITION: () => WEBHOOK_DEFINITION,
  Webhook: () => Webhook
});
var import_core = __toModule(require("@aws-cdk/core"));
var import_aws_apigatewayv2 = __toModule(require("@aws-cdk/aws-apigatewayv2"));
var import_aws_lambda = __toModule(require("@aws-cdk/aws-lambda"));
var import_aws_events = __toModule(require("@aws-cdk/aws-events"));
var import_aws_iam = __toModule(require("@aws-cdk/aws-iam"));
const WEBHOOK_DEFINITION = {
  type: "object",
  properties: {
    type: {const: "webhook"},
    authorizer: {
      type: "object",
      properties: {
        handler: {type: "string"}
      },
      required: ["handler"],
      additionalProperties: true
    },
    insecure: {type: "boolean"},
    path: {type: "string"},
    eventType: {type: "string"}
  },
  required: ["path"],
  additionalProperties: false
};
const WEBHOOK_DEFAULTS = {
  insecure: false
};
class Webhook extends import_core.Construct {
  constructor(scope, id, configuration, provider) {
    super(scope, id);
    this.id = id;
    this.configuration = configuration;
    this.provider = provider;
    var _a;
    const api = new import_aws_apigatewayv2.HttpApi(this, "HttpApi");
    this.apiEndpointOutput = new import_core.CfnOutput(this, "HttpApiEndpoint", {
      value: api.apiEndpoint
    });
    const bus = new import_aws_events.EventBus(this, "Bus");
    this.bus = bus;
    const apiGatewayRole = new import_aws_iam.Role(this, "ApiGatewayRole", {
      assumedBy: new import_aws_iam.ServicePrincipal("apigateway.amazonaws.com"),
      inlinePolicies: {
        EventBridge: new import_aws_iam.PolicyDocument({
          statements: [
            new import_aws_iam.PolicyStatement({
              actions: ["events:PutEvents"],
              resources: [bus.eventBusArn]
            })
          ]
        })
      }
    });
    const resolvedConfiguration = Object.assign({}, WEBHOOK_DEFAULTS, configuration);
    if (resolvedConfiguration.insecure && resolvedConfiguration.authorizer !== void 0) {
      throw new Error(`Webhook ${id} is specified as insecure, however an authorizer is configured for this webhook. Either declare this webhook as secure by removing \`insecure: true\` property (recommended), or specify the webhook as insecure and remove the authorizer property altogether.`);
    }
    if (!resolvedConfiguration.insecure && resolvedConfiguration.authorizer === void 0) {
      throw new Error(`Webhook ${id} is specified as secure, however no authorizer is configured for this webhook. Please provide an authorizer property for this webhook (recommended), or specify the webhook as insecure by adding \`insecure: true\` property.`);
    }
    const eventBridgeIntegration = new import_aws_apigatewayv2.CfnIntegration(this, "Integration", {
      apiId: api.apiId,
      connectionType: "INTERNET",
      credentialsArn: apiGatewayRole.roleArn,
      integrationSubtype: "EventBridge-PutEvents",
      integrationType: "AWS_PROXY",
      payloadFormatVersion: "1.0",
      requestParameters: {
        DetailType: (_a = resolvedConfiguration.eventType) != null ? _a : "Webhook",
        Detail: "$request.body",
        Source: id,
        EventBusName: bus.eventBusName
      }
    });
    const route = new import_aws_apigatewayv2.CfnRoute(this, "Route", {
      apiId: api.apiId,
      routeKey: `POST ${resolvedConfiguration.path}`,
      target: import_core.Fn.join("/", ["integrations", eventBridgeIntegration.ref]),
      authorizationType: "NONE"
    });
    if (!resolvedConfiguration.insecure) {
      const lambda = import_aws_lambda.Function.fromFunctionArn(this, "LambdaAuthorizer", import_core.Fn.getAtt(provider.naming.getLambdaLogicalId(`${id}Authorizer`), "Arn"));
      lambda.grantInvoke(apiGatewayRole);
      const authorizer = new import_aws_apigatewayv2.CfnAuthorizer(this, "Authorizer", {
        apiId: api.apiId,
        authorizerPayloadFormatVersion: "2.0",
        authorizerType: "REQUEST",
        name: `${id}-authorizer`,
        identitySource: ["$request.header.Authorization"],
        enableSimpleResponses: true,
        authorizerUri: import_core.Fn.join("/", [
          `arn:aws:apigateway:${this.provider.region}:lambda:path/2015-03-31/functions`,
          lambda.functionArn,
          "invocations"
        ]),
        authorizerCredentialsArn: apiGatewayRole.roleArn
      });
      route.authorizerId = authorizer.ref;
      route.authorizationType = "CUSTOM";
    }
    this.endpointPathOutput = new import_core.CfnOutput(this, "Endpoint", {
      value: route.routeKey
    });
    this.appendFunctions();
  }
  commands() {
    return {};
  }
  outputs() {
    return {
      httpMethod: () => this.getHttpMethod(),
      url: () => this.getUrl()
    };
  }
  references() {
    return {
      busName: this.referenceBusName()
    };
  }
  appendFunctions() {
    const resolvedWebhookConfiguration = Object.assign({}, WEBHOOK_DEFAULTS, this.configuration);
    if (resolvedWebhookConfiguration.insecure) {
      return;
    }
    this.provider.addFunction(`${this.id}Authorizer`, resolvedWebhookConfiguration.authorizer);
  }
  async getEndpointPath() {
    return this.provider.getStackOutput(this.endpointPathOutput);
  }
  async getHttpMethod() {
    const endpointPath = await this.getEndpointPath();
    if (endpointPath === void 0) {
      return void 0;
    }
    const [httpMethod] = endpointPath.split(" ");
    return httpMethod;
  }
  async getUrl() {
    const apiEndpoint = await this.provider.getStackOutput(this.apiEndpointOutput);
    if (apiEndpoint === void 0) {
      return void 0;
    }
    const endpointPath = await this.getEndpointPath();
    if (endpointPath === void 0) {
      return void 0;
    }
    const [, path] = endpointPath.split(" ");
    return apiEndpoint + path;
  }
  referenceBusName() {
    return this.provider.getCloudFormationReference(this.bus.eventBusName);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WEBHOOK_DEFINITION,
  Webhook
});
//# sourceMappingURL=Webhook.js.map
