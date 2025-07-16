import basicAuth from "express-basic-auth";
import type { ConfigManagerOptions } from "../../core/types.js";

export function createBasicAuth(config: ConfigManagerOptions) {
  return basicAuth({
    users: {
      [config.admin.username]: config.admin.password
    },
    challenge: true,
    realm: "ConfigManager Admin"
  });
}