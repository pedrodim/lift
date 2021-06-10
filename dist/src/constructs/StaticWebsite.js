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
  STATIC_WEBSITE_DEFINITION: () => STATIC_WEBSITE_DEFINITION,
  StaticWebsite: () => StaticWebsite
});
var import_aws_s3 = __toModule(require("@aws-cdk/aws-s3"));
var import_aws_cloudfront = __toModule(require("@aws-cdk/aws-cloudfront"));
var cloudfront = __toModule(require("@aws-cdk/aws-cloudfront"));
var import_core = __toModule(require("@aws-cdk/core"));
var import_chalk = __toModule(require("chalk"));
var import_aws_cloudfront_origins = __toModule(require("@aws-cdk/aws-cloudfront-origins"));
var acm = __toModule(require("@aws-cdk/aws-certificatemanager"));
var import_logger = __toModule(require("../utils/logger"));
var import_s3_sync = __toModule(require("../utils/s3-sync"));
const STATIC_WEBSITE_DEFINITION = {
  type: "object",
  properties: {
    type: {const: "static-website"},
    path: {type: "string"},
    domain: {
      anyOf: [
        {type: "string"},
        {
          type: "array",
          items: {type: "string"}
        }
      ]
    },
    certificate: {type: "string"},
    security: {
      type: "object",
      properties: {
        allowIframe: {type: "boolean"}
      },
      additionalProperties: false
    }
  },
  additionalProperties: false,
  required: ["path"]
};
class StaticWebsite extends import_core.Construct {
  constructor(scope, id, configuration, provider) {
    super(scope, id);
    this.id = id;
    this.configuration = configuration;
    this.provider = provider;
    if (configuration.domain !== void 0 && configuration.certificate === void 0) {
      throw new Error(`Invalid configuration for the static website ${id}: if a domain is configured, then a certificate ARN must be configured as well.`);
    }
    const bucket = new import_aws_s3.Bucket(this, "Bucket", {
      removalPolicy: import_core.RemovalPolicy.DESTROY
    });
    const cloudFrontOAI = new import_aws_cloudfront.OriginAccessIdentity(this, "OriginAccessIdentity", {
      comment: `Identity that represents CloudFront for the ${id} static website.`
    });
    bucket.grantRead(cloudFrontOAI);
    const domains = configuration.domain !== void 0 ? [configuration.domain].flat() : void 0;
    const certificate = configuration.certificate !== void 0 ? acm.Certificate.fromCertificateArn(this, "Certificate", configuration.certificate) : void 0;
    const distribution = new import_aws_cloudfront.Distribution(this, "CDN", {
      comment: `${provider.stackName} ${id} website CDN`,
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: new import_aws_cloudfront_origins.S3Origin(bucket, {
          originAccessIdentity: cloudFrontOAI
        }),
        allowedMethods: import_aws_cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: import_aws_cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: import_aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [
          {
            function: this.createResponseFunction(),
            eventType: import_aws_cloudfront.FunctionEventType.VIEWER_RESPONSE
          }
        ]
      },
      errorResponses: [
        {
          httpStatus: 404,
          ttl: import_core.Duration.seconds(0),
          responseHttpStatus: 200,
          responsePagePath: "/index.html"
        }
      ],
      httpVersion: import_aws_cloudfront.HttpVersion.HTTP2,
      certificate,
      domainNames: domains
    });
    this.bucketNameOutput = new import_core.CfnOutput(this, "BucketName", {
      description: "Name of the bucket that stores the static website.",
      value: bucket.bucketName
    });
    let websiteDomain = distribution.distributionDomainName;
    if (configuration.domain !== void 0) {
      websiteDomain = typeof configuration.domain === "string" ? configuration.domain : configuration.domain[0];
    }
    this.domainOutput = new import_core.CfnOutput(this, "Domain", {
      description: "Website domain name.",
      value: websiteDomain
    });
    this.cnameOutput = new import_core.CfnOutput(this, "CloudFrontCName", {
      description: "CloudFront CNAME.",
      value: distribution.distributionDomainName
    });
    this.distributionIdOutput = new import_core.CfnOutput(this, "DistributionId", {
      description: "ID of the CloudFront distribution.",
      value: distribution.distributionId
    });
  }
  commands() {
    return {
      upload: this.uploadWebsite.bind(this)
    };
  }
  outputs() {
    return {
      url: () => this.getUrl(),
      cname: () => this.getCName()
    };
  }
  references() {
    return {};
  }
  async postDeploy() {
    await this.uploadWebsite();
  }
  async uploadWebsite() {
    (0, import_logger.log)(`Deploying the static website '${this.id}'`);
    const bucketName = await this.getBucketName();
    if (bucketName === void 0) {
      throw new Error(`Could not find the bucket in which to deploy the '${this.id}' website: did you forget to run 'serverless deploy' first?`);
    }
    (0, import_logger.log)(`Uploading directory '${this.configuration.path}' to bucket '${bucketName}'`);
    const {hasChanges} = await (0, import_s3_sync.s3Sync)({
      aws: this.provider,
      localPath: this.configuration.path,
      bucketName
    });
    if (hasChanges) {
      await this.clearCDNCache();
    }
    const domain = await this.getDomain();
    if (domain !== void 0) {
      (0, import_logger.log)(`Deployed ${import_chalk.default.green(`https://${domain}`)}`);
    }
  }
  async clearCDNCache() {
    const distributionId = await this.getDistributionId();
    if (distributionId === void 0) {
      return;
    }
    await this.provider.request("CloudFront", "createInvalidation", {
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: Date.now().toString(),
        Paths: {
          Items: ["/*"],
          Quantity: 1
        }
      }
    });
  }
  async preRemove() {
    const bucketName = await this.getBucketName();
    if (bucketName === void 0) {
      return;
    }
    (0, import_logger.log)(`Emptying S3 bucket '${bucketName}' for the '${this.id}' static website, else CloudFormation will fail (it cannot delete a non-empty bucket)`);
    const data = await this.provider.request("S3", "listObjectsV2", {
      Bucket: bucketName
    });
    if (data.Contents === void 0) {
      return;
    }
    const keys = data.Contents.map((item) => item.Key).filter((key) => key !== void 0);
    await this.provider.request("S3", "deleteObjects", {
      Bucket: bucketName,
      Delete: {
        Objects: keys.map((key) => ({Key: key}))
      }
    });
  }
  async getUrl() {
    const domain = await this.getDomain();
    if (domain === void 0) {
      return void 0;
    }
    return `https://${domain}`;
  }
  async getBucketName() {
    return this.provider.getStackOutput(this.bucketNameOutput);
  }
  async getDomain() {
    return this.provider.getStackOutput(this.domainOutput);
  }
  async getCName() {
    return this.provider.getStackOutput(this.cnameOutput);
  }
  async getDistributionId() {
    return this.provider.getStackOutput(this.distributionIdOutput);
  }
  createResponseFunction() {
    var _a;
    const securityHeaders = {
      "x-frame-options": {value: "SAMEORIGIN"},
      "x-content-type-options": {value: "nosniff"},
      "x-xss-protection": {value: "1; mode=block"},
      "strict-transport-security": {value: "max-age=63072000"}
    };
    if (((_a = this.configuration.security) == null ? void 0 : _a.allowIframe) === true) {
      delete securityHeaders["x-frame-options"];
    }
    const jsonHeaders = JSON.stringify(securityHeaders, void 0, 4);
    const code = `function handler(event) {
    var response = event.response;
    response.headers = Object.assign({}, ${jsonHeaders}, response.headers);
    return response;
}`;
    return new cloudfront.Function(this, "ResponseFunction", {
      functionName: `${this.provider.stackName}-${this.provider.region}-${this.id}-response`,
      code: cloudfront.FunctionCode.fromInline(code)
    });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  STATIC_WEBSITE_DEFINITION,
  StaticWebsite
});
//# sourceMappingURL=StaticWebsite.js.map
