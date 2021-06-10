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
  constructs: () => constructs
});
var import_Storage = __toModule(require("./Storage"));
var import_Queue = __toModule(require("./Queue"));
var import_StaticWebsite = __toModule(require("./StaticWebsite"));
var import_Webhook = __toModule(require("./Webhook"));
const constructs = {
  storage: {
    class: import_Storage.Storage,
    schema: import_Storage.STORAGE_DEFINITION
  },
  queue: {
    class: import_Queue.Queue,
    schema: import_Queue.QUEUE_DEFINITION
  },
  "static-website": {
    class: import_StaticWebsite.StaticWebsite,
    schema: import_StaticWebsite.STATIC_WEBSITE_DEFINITION
  },
  webhook: {
    class: import_Webhook.Webhook,
    schema: import_Webhook.WEBHOOK_DEFINITION
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  constructs
});
//# sourceMappingURL=index.js.map
