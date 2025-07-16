import type { ConfigManagerOptions } from "./core/types.js";
export type { ConfigManagerOptions, AppConfig, NamedConfig, ConfigData, ValidationError, ConfigRequest, ConfigResponse } from "./core/types.js";
export { ConfigClient, createConfigClient, type ConfigClientOptions } from "./client.js";
export declare const configManager: {
    start(options: ConfigManagerOptions): Promise<void>;
};
//# sourceMappingURL=index.d.ts.map