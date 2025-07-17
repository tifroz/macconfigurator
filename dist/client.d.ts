export interface ConfigClientOptions {
    baseUrl: string;
    applicationId: string;
}
export declare class ConfigClient {
    private baseUrl;
    private applicationId;
    constructor(options: ConfigClientOptions);
    /**
     * Fetch configuration for a specific version
     * @param version - Semantic version string (e.g., "1.0.0")
     * @param configName - Optional named configuration (e.g., "production", "staging")
     */
    getConfig<T = any>(version: string, configName?: string): Promise<T>;
    /**
     * Check if a specific version matches the semver range for a named config
     */
    checkVersion(version: string, configName: string): Promise<boolean>;
}
/**
 * Create a config client instance
 */
export declare function createConfigClient(baseUrl: string, applicationId: string): ConfigClient;
//# sourceMappingURL=client.d.ts.map