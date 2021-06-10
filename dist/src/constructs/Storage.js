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
  STORAGE_DEFINITION: () => STORAGE_DEFINITION,
  Storage: () => Storage
});
var import_aws_s3 = __toModule(require("@aws-cdk/aws-s3"));
var import_core = __toModule(require("@aws-cdk/core"));
var import_Stack = __toModule(require("../Stack"));
const STORAGE_DEFINITION = {
  type: "object",
  properties: {
    type: {const: "storage"},
    archive: {type: "number", minimum: 30},
    encryption: {
      anyOf: [{const: "s3"}, {const: "kms"}]
    }
  },
  additionalProperties: false
};
const STORAGE_DEFAULTS = {
  type: "storage",
  archive: 45,
  encryption: "s3"
};
class Storage extends import_core.Construct {
  constructor(scope, id, configuration, provider) {
    super(scope, id);
    this.provider = provider;
    const resolvedConfiguration = Object.assign({}, STORAGE_DEFAULTS, configuration);
    const encryptionOptions = {
      s3: import_aws_s3.BucketEncryption.S3_MANAGED,
      kms: import_aws_s3.BucketEncryption.KMS_MANAGED
    };
    this.bucket = new import_aws_s3.Bucket(this, "Bucket", {
      encryption: encryptionOptions[resolvedConfiguration.encryption],
      versioned: true,
      blockPublicAccess: import_aws_s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: import_aws_s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: import_core.Duration.days(0)
            }
          ]
        },
        {
          noncurrentVersionExpiration: import_core.Duration.days(30)
        }
      ]
    });
    this.bucketNameOutput = new import_core.CfnOutput(this, "BucketName", {
      value: this.bucket.bucketName
    });
  }
  references() {
    return {
      bucketArn: this.referenceBucketArn(),
      bucketName: this.referenceBucketName()
    };
  }
  permissions() {
    return [
      new import_Stack.PolicyStatement(["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"], [
        this.referenceBucketArn(),
        import_core.Stack.of(this).resolve(import_core.Fn.join("/", [this.referenceBucketArn(), "*"]))
      ])
    ];
  }
  commands() {
    return {};
  }
  outputs() {
    return {
      bucketName: () => this.getBucketName()
    };
  }
  referenceBucketName() {
    return this.provider.getCloudFormationReference(this.bucket.bucketName);
  }
  referenceBucketArn() {
    return this.provider.getCloudFormationReference(this.bucket.bucketArn);
  }
  async getBucketName() {
    return this.provider.getStackOutput(this.bucketNameOutput);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  STORAGE_DEFINITION,
  Storage
});
//# sourceMappingURL=Storage.js.map
