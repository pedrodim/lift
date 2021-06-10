var __create = Object.create;
var __defProp = Object.defineProperty;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
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
var import_aws_sdk_mock = __toModule(require("aws-sdk-mock"));
var sinon = __toModule(require("sinon"));
var fs = __toModule(require("fs"));
var path = __toModule(require("path"));
var import_runServerless = __toModule(require("../utils/runServerless"));
var CloudFormationHelpers = __toModule(require("../../src/CloudFormation"));
var import_s3_sync = __toModule(require("../../src/utils/s3-sync"));
describe("static websites", () => {
  afterEach(() => {
    sinon.restore();
    import_aws_sdk_mock.default.restore();
  });
  it("should create all required resources", async () => {
    const {cfTemplate, computeLogicalId} = await (0, import_runServerless.runServerless)({
      cliArgs: ["package"],
      config: Object.assign(import_runServerless.baseConfig, {
        constructs: {
          landing: {
            type: "static-website",
            path: "."
          }
        }
      })
    });
    const bucketLogicalId = computeLogicalId("landing", "Bucket");
    const bucketPolicyLogicalId = computeLogicalId("landing", "Bucket", "Policy");
    const originAccessIdentityLogicalId = computeLogicalId("landing", "OriginAccessIdentity");
    const edgeFunction = computeLogicalId("landing", "ResponseFunction");
    const cfDistributionLogicalId = computeLogicalId("landing", "CDN");
    const cfOriginId = computeLogicalId("landing", "CDN", "Origin1");
    expect(Object.keys(cfTemplate.Resources)).toStrictEqual([
      "ServerlessDeploymentBucket",
      "ServerlessDeploymentBucketPolicy",
      bucketLogicalId,
      bucketPolicyLogicalId,
      originAccessIdentityLogicalId,
      edgeFunction,
      cfDistributionLogicalId
    ]);
    expect(cfTemplate.Resources[bucketLogicalId]).toMatchObject({
      Type: "AWS::S3::Bucket",
      UpdateReplacePolicy: "Delete",
      DeletionPolicy: "Delete"
    });
    expect(cfTemplate.Resources[bucketPolicyLogicalId]).toMatchObject({
      Properties: {
        Bucket: {
          Ref: bucketLogicalId
        },
        PolicyDocument: {
          Statement: [
            {
              Action: ["s3:GetObject*", "s3:GetBucket*", "s3:List*"],
              Effect: "Allow",
              Principal: {
                CanonicalUser: {
                  "Fn::GetAtt": [originAccessIdentityLogicalId, "S3CanonicalUserId"]
                }
              },
              Resource: [
                {
                  "Fn::GetAtt": [bucketLogicalId, "Arn"]
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      {
                        "Fn::GetAtt": [bucketLogicalId, "Arn"]
                      },
                      "/*"
                    ]
                  ]
                }
              ]
            }
          ],
          Version: "2012-10-17"
        }
      }
    });
    expect(cfTemplate.Resources[originAccessIdentityLogicalId]).toMatchObject({
      Type: "AWS::CloudFront::CloudFrontOriginAccessIdentity",
      Properties: {
        CloudFrontOriginAccessIdentityConfig: {
          Comment: "Identity that represents CloudFront for the landing static website."
        }
      }
    });
    expect(cfTemplate.Resources[cfDistributionLogicalId]).toMatchObject({
      Type: "AWS::CloudFront::Distribution",
      Properties: {
        DistributionConfig: {
          CustomErrorResponses: [
            {
              ErrorCachingMinTTL: 0,
              ErrorCode: 404,
              ResponseCode: 200,
              ResponsePagePath: "/index.html"
            }
          ],
          DefaultCacheBehavior: {
            AllowedMethods: ["GET", "HEAD", "OPTIONS"],
            Compress: true,
            TargetOriginId: cfOriginId,
            ViewerProtocolPolicy: "redirect-to-https",
            FunctionAssociations: [
              {
                EventType: "viewer-response",
                FunctionARN: {
                  "Fn::GetAtt": [edgeFunction, "FunctionARN"]
                }
              }
            ]
          },
          DefaultRootObject: "index.html",
          Enabled: true,
          HttpVersion: "http2",
          IPV6Enabled: true,
          Origins: [
            {
              DomainName: {
                "Fn::GetAtt": [bucketLogicalId, "RegionalDomainName"]
              },
              Id: cfOriginId,
              S3OriginConfig: {
                OriginAccessIdentity: {
                  "Fn::Join": [
                    "",
                    [
                      "origin-access-identity/cloudfront/",
                      {
                        Ref: originAccessIdentityLogicalId
                      }
                    ]
                  ]
                }
              }
            }
          ]
        }
      }
    });
    expect(cfTemplate.Outputs).toMatchObject({
      [computeLogicalId("landing", "BucketName")]: {
        Description: "Name of the bucket that stores the static website.",
        Value: {
          Ref: bucketLogicalId
        }
      },
      [computeLogicalId("landing", "Domain")]: {
        Description: "Website domain name.",
        Value: {
          "Fn::GetAtt": [cfDistributionLogicalId, "DomainName"]
        }
      },
      [computeLogicalId("landing", "CloudFrontCName")]: {
        Description: "CloudFront CNAME.",
        Value: {
          "Fn::GetAtt": [cfDistributionLogicalId, "DomainName"]
        }
      },
      [computeLogicalId("landing", "DistributionId")]: {
        Description: "ID of the CloudFront distribution.",
        Value: {
          Ref: cfDistributionLogicalId
        }
      }
    });
    expect(cfTemplate.Resources[edgeFunction]).toMatchObject({
      Type: "AWS::CloudFront::Function",
      Properties: {
        AutoPublish: true,
        FunctionConfig: {
          Comment: "app-dev-us-east-1-landing-response",
          Runtime: "cloudfront-js-1.0"
        },
        Name: "app-dev-us-east-1-landing-response"
      }
    });
  });
  it("should support a custom domain", async () => {
    const {cfTemplate, computeLogicalId} = await (0, import_runServerless.runServerless)({
      cliArgs: ["package"],
      config: Object.assign(import_runServerless.baseConfig, {
        constructs: {
          landing: {
            type: "static-website",
            path: ".",
            domain: "example.com",
            certificate: "arn:aws:acm:us-east-1:123456615250:certificate/0a28e63d-d3a9-4578-9f8b-14347bfe8123"
          }
        }
      })
    });
    const cfDistributionLogicalId = computeLogicalId("landing", "CDN");
    expect(cfTemplate.Resources[cfDistributionLogicalId]).toMatchObject({
      Type: "AWS::CloudFront::Distribution",
      Properties: {
        DistributionConfig: {
          Aliases: ["example.com"],
          ViewerCertificate: {
            AcmCertificateArn: "arn:aws:acm:us-east-1:123456615250:certificate/0a28e63d-d3a9-4578-9f8b-14347bfe8123",
            MinimumProtocolVersion: "TLSv1.2_2019",
            SslSupportMethod: "sni-only"
          }
        }
      }
    });
    expect(cfTemplate.Outputs).toMatchObject({
      [computeLogicalId("landing", "Domain")]: {
        Description: "Website domain name.",
        Value: "example.com"
      },
      [computeLogicalId("landing", "CloudFrontCName")]: {
        Description: "CloudFront CNAME.",
        Value: {
          "Fn::GetAtt": [cfDistributionLogicalId, "DomainName"]
        }
      }
    });
  });
  it("should support multiple custom domains", async () => {
    const {cfTemplate, computeLogicalId} = await (0, import_runServerless.runServerless)({
      cliArgs: ["package"],
      config: Object.assign(import_runServerless.baseConfig, {
        constructs: {
          landing: {
            type: "static-website",
            path: ".",
            domain: ["example.com", "www.example.com"],
            certificate: "arn:aws:acm:us-east-1:123456615250:certificate/0a28e63d-d3a9-4578-9f8b-14347bfe8123"
          }
        }
      })
    });
    const cfDistributionLogicalId = computeLogicalId("landing", "CDN");
    expect(cfTemplate.Resources[cfDistributionLogicalId]).toMatchObject({
      Type: "AWS::CloudFront::Distribution",
      Properties: {
        DistributionConfig: {
          Aliases: ["example.com", "www.example.com"]
        }
      }
    });
    expect(cfTemplate.Outputs).toMatchObject({
      [computeLogicalId("landing", "Domain")]: {
        Description: "Website domain name.",
        Value: "example.com"
      },
      [computeLogicalId("landing", "CloudFrontCName")]: {
        Description: "CloudFront CNAME.",
        Value: {
          "Fn::GetAtt": [cfDistributionLogicalId, "DomainName"]
        }
      }
    });
  });
  it("should allow to customize security HTTP headers", async () => {
    const {cfTemplate, computeLogicalId} = await (0, import_runServerless.runServerless)({
      cliArgs: ["package"],
      config: Object.assign(import_runServerless.baseConfig, {
        constructs: {
          landing: {
            type: "static-website",
            path: ".",
            security: {
              allowIframe: true
            }
          }
        }
      })
    });
    const edgeFunction = computeLogicalId("landing", "ResponseFunction");
    expect(cfTemplate.Resources[edgeFunction]).toMatchObject({
      Type: "AWS::CloudFront::Function",
      Properties: {
        FunctionCode: `function handler(event) {
    var response = event.response;
    response.headers = Object.assign({}, {
    "x-content-type-options": {
        "value": "nosniff"
    },
    "x-xss-protection": {
        "value": "1; mode=block"
    },
    "strict-transport-security": {
        "value": "max-age=63072000"
    }
}, response.headers);
    return response;
}`
      }
    });
  });
  it("should synchronize files to S3", async () => {
    sinon.stub(CloudFormationHelpers, "getStackOutput").returns(Promise.resolve("bucket-name"));
    mockBucketContent([
      {
        Key: "index.html",
        ETag: (0, import_s3_sync.computeS3ETag)(fs.readFileSync(path.join(__dirname, "../fixtures/staticWebsites/public/index.html")))
      },
      {Key: "styles.css"},
      {Key: "image.jpg"}
    ]);
    const putObjectSpy = sinon.stub().returns(Promise.resolve());
    import_aws_sdk_mock.default.mock("S3", "putObject", putObjectSpy);
    const deleteObjectsSpy = sinon.stub().returns(Promise.resolve());
    import_aws_sdk_mock.default.mock("S3", "deleteObjects", deleteObjectsSpy);
    const cloudfrontInvalidationSpy = sinon.stub().returns(Promise.resolve());
    import_aws_sdk_mock.default.mock("CloudFront", "createInvalidation", cloudfrontInvalidationSpy);
    await (0, import_runServerless.runServerless)({
      fixture: "staticWebsites",
      configExt: import_runServerless.pluginConfigExt,
      cliArgs: ["landing:upload"]
    });
    sinon.assert.callCount(putObjectSpy, 2);
    expect(putObjectSpy.firstCall.firstArg).toEqual({
      Bucket: "bucket-name",
      Key: "scripts.js",
      Body: fs.readFileSync(path.join(__dirname, "../fixtures/staticWebsites/public/scripts.js")),
      ContentType: "application/javascript"
    });
    expect(putObjectSpy.secondCall.firstArg).toEqual({
      Bucket: "bucket-name",
      Key: "styles.css",
      Body: fs.readFileSync(path.join(__dirname, "../fixtures/staticWebsites/public/styles.css")),
      ContentType: "text/css"
    });
    sinon.assert.calledOnce(deleteObjectsSpy);
    expect(deleteObjectsSpy.firstCall.firstArg).toEqual({
      Bucket: "bucket-name",
      Delete: {
        Objects: [
          {
            Key: "image.jpg"
          }
        ]
      }
    });
    sinon.assert.calledOnce(cloudfrontInvalidationSpy);
  });
});
function mockBucketContent(objects) {
  import_aws_sdk_mock.default.mock("S3", "listObjectsV2", (params, callback) => {
    callback(null, {
      IsTruncated: false,
      Contents: objects
    });
  });
}
//# sourceMappingURL=staticWebsites.test.js.map
