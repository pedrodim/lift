var __defProp = Object.defineProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {get: all[name], enumerable: true});
};
__markAsModule(exports);
__export(exports, {
  cidrSubnets: () => cidrSubnets,
  cidrVpc: () => cidrVpc,
  getZoneId: () => getZoneId
});
const cidrVpc = "10.0.0.0/16";
const cidrSubnets = {
  a: {
    Private: "10.0.0.0/19",
    Public: "10.0.32.0/19"
  },
  b: {
    Private: "10.0.64.0/19",
    Public: "10.0.96.0/19"
  },
  c: {
    Private: "10.0.128.0/19",
    Public: "10.0.160.0/19"
  }
};
function getZoneId(availabilityZone) {
  const id = availabilityZone.substr(-1, 1);
  if (id !== "a" && id !== "b" && id !== "c") {
    throw new Error(`Availability zone ${id} is not supported (cannot generate CIDR block).`);
  }
  return id;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  cidrSubnets,
  cidrVpc,
  getZoneId
});
//# sourceMappingURL=Cidr.js.map
