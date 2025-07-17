export interface AppConfig {
    applicationId: string;
    archived: boolean;
    namedConfigs: Record<string, NamedConfig>;
    defaultConfig: ConfigData;
    schema: any;
    lastUpdated: Date;
}
export interface NamedConfig {
    data: any;
    versions: string[];
}
export interface ConfigData {
    data: any;
}
export interface ConfigManagerOptions {
    port: number;
    mountPath?: string;
    logger: any;
    admin: {
        username: string;
        password: string;
    };
    mongodb?: {
        host: string;
        port: number;
        collection: string;
        auth: {
            database: string;
            user: string;
            password: string;
        };
    };
}
export interface ValidationError {
    field: string;
    message: string;
    value?: any;
}
export interface ConfigRequest {
    applicationId: string;
    version: string;
}
export interface ConfigResponse {
    data: any;
    cacheControl: string;
}
//# sourceMappingURL=types.d.ts.map