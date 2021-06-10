var __defProp = Object.defineProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {get: all[name], enumerable: true});
};
__markAsModule(exports);
__export(exports, {
  PolicyStatement: () => PolicyStatement
});
class PolicyStatement {
  constructor(Action, Resource) {
    this.Effect = "Allow";
    this.Action = Action;
    this.Resource = Resource;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PolicyStatement
});
//# sourceMappingURL=Stack.js.map
