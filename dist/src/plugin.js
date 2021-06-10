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
var import_core = __toModule(require("@aws-cdk/core"));
var import_lodash = __toModule(require("lodash"));
var import_chalk = __toModule(require("chalk"));
var path = __toModule(require("path"));
var import_fs = __toModule(require("fs"));
var import_js_yaml = __toModule(require("js-yaml"));
var import_AwsProvider = __toModule(require("./classes/AwsProvider"));
var import_constructs = __toModule(require("./constructs"));
var import_logger = __toModule(require("./utils/logger"));
const CONSTRUCTS_DEFINITION = {
  type: "object",
  patternProperties: {
    "^[a-zA-Z0-9-_]+$": {
      allOf: [
        {
          anyOf: [
            import_constructs.constructs.storage.schema,
            import_constructs.constructs["static-website"].schema,
            import_constructs.constructs.webhook.schema,
            import_constructs.constructs.queue.schema
          ]
        },
        {
          type: "object",
          properties: {
            type: {type: "string"}
          },
          required: ["type"]
        }
      ]
    }
  },
  additionalProperties: false
};
class LiftPlugin {
  constructor(serverless) {
    this.constructs = {};
    this.commands = {};
    this.configurationVariablesSources = {};
    this.app = new import_core.App();
    this.stack = new import_core.Stack(this.app);
    serverless.stack = this.stack;
    this.serverless = serverless;
    this.commands.lift = {
      commands: {
        eject: {
          lifecycleEvents: ["eject"]
        }
      }
    };
    this.hooks = {
      initialize: this.initialize.bind(this),
      "before:aws:info:displayStackOutputs": this.info.bind(this),
      "after:package:compileEvents": this.appendCloudformationResources.bind(this),
      "after:deploy:deploy": this.postDeploy.bind(this),
      "before:remove:remove": this.preRemove.bind(this),
      "lift:eject:eject": this.eject.bind(this)
    };
    this.configurationVariablesSources = {
      construct: {
        resolve: this.resolveReference.bind(this)
      }
    };
    this.registerConfigSchema();
  }
  initialize() {
    this.loadConstructs();
    this.registerCommands();
    this.appendPermissions();
  }
  registerConfigSchema() {
    this.serverless.configSchemaHandler.defineTopLevelProperty("constructs", CONSTRUCTS_DEFINITION);
  }
  loadConstructs() {
    const awsProvider = new import_AwsProvider.default(this.serverless, this.stack);
    const constructsInputConfiguration = (0, import_lodash.get)(this.serverless.configurationInput, "constructs", {});
    for (const [id, configuration] of Object.entries(constructsInputConfiguration)) {
      const constructConstructor = import_constructs.constructs[configuration.type].class;
      this.constructs[id] = new constructConstructor(awsProvider.stack, id, configuration, awsProvider);
    }
  }
  resolveReference({address}) {
    const [id, property] = address.split(".", 2);
    if (!(0, import_lodash.has)(this.constructs, id)) {
      throw new Error(`No construct named '${id}' was found, the \${construct:${id}.${property}} variable is invalid.`);
    }
    const construct = this.constructs[id];
    const properties = construct.references();
    if (!(0, import_lodash.has)(properties, property)) {
      throw new Error(`\${construct:${id}.${property}} does not exist. Properties available on \${construct:${id}} are: ${Object.keys(properties).join(", ")}.`);
    }
    return {
      value: properties[property]
    };
  }
  async info() {
    for (const [id, construct] of Object.entries(this.constructs)) {
      const outputs = construct.outputs();
      if (Object.keys(outputs).length > 0) {
        console.log(import_chalk.default.yellow(`${id}:`));
        for (const [name, resolver] of Object.entries(outputs)) {
          const output = await resolver();
          if (output !== void 0) {
            console.log(`  ${name}: ${output}`);
          }
        }
      }
    }
  }
  registerCommands() {
    for (const [id, construct] of Object.entries(this.constructs)) {
      const commands = construct.commands();
      for (const [command, handler] of Object.entries(commands)) {
        this.commands[`${id}:${command}`] = {
          lifecycleEvents: [command]
        };
        this.hooks[`${id}:${command}:${command}`] = handler;
      }
    }
  }
  async postDeploy() {
    for (const [, construct] of Object.entries(this.constructs)) {
      if (construct.postDeploy !== void 0) {
        await construct.postDeploy();
      }
    }
  }
  async preRemove() {
    for (const [, construct] of Object.entries(this.constructs)) {
      if (construct.preRemove !== void 0) {
        await construct.preRemove();
      }
    }
  }
  appendCloudformationResources() {
    (0, import_lodash.merge)(this.serverless.service, {
      resources: this.app.synth().getStackByName(this.stack.stackName).template
    });
  }
  appendPermissions() {
    var _a;
    const statements = Object.entries(this.constructs).map(([, construct]) => {
      return construct.permissions ? construct.permissions() : [];
    }).flat(1);
    if (statements.length === 0) {
      return;
    }
    this.serverless.service.provider.iamRoleStatements = (_a = this.serverless.service.provider.iamRoleStatements) != null ? _a : [];
    this.serverless.service.provider.iamRoleStatements.push(...statements);
  }
  async eject() {
    (0, import_logger.log)("Ejecting from Lift to CloudFormation");
    await this.serverless.pluginManager.spawn("package");
    const legacyProvider = this.serverless.getProvider("aws");
    const compiledTemplateFileName = legacyProvider.naming.getCompiledTemplateFileName();
    const compiledTemplateFilePath = path.join(this.serverless.serviceDir, ".serverless", compiledTemplateFileName);
    const cfTemplate = (0, import_fs.readFileSync)(compiledTemplateFilePath);
    const formattedYaml = (0, import_js_yaml.dump)(JSON.parse(cfTemplate.toString()));
    console.log(formattedYaml);
    (0, import_logger.log)("You can also find that CloudFormation template in the following file:");
    (0, import_logger.log)(compiledTemplateFilePath);
  }
}
module.exports = LiftPlugin;
//# sourceMappingURL=plugin.js.map
