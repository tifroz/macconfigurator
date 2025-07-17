import { Effect, Context } from "effect";
import type { AppConfig, ConfigRequest, ConfigResponse, ValidationError } from "../types.js";
export interface ConfigService {
    listApplications(): Effect.Effect<AppConfig[], Error>;
    getApplication(applicationId: string): Effect.Effect<AppConfig | null, Error>;
    createApplication(config: AppConfig): Effect.Effect<AppConfig, Error | ValidationError[]>;
    updateApplication(applicationId: string, config: Partial<AppConfig>): Effect.Effect<AppConfig, Error | ValidationError[]>;
    archiveApplication(applicationId: string): Effect.Effect<void, Error>;
    unarchiveApplication(applicationId: string): Effect.Effect<void, Error>;
    getConfig(request: ConfigRequest): Effect.Effect<ConfigResponse | null, Error>;
    createNamedConfig(applicationId: string, name: string, data: any, versions: string[]): Effect.Effect<AppConfig, Error | ValidationError[]>;
    updateNamedConfig(applicationId: string, name: string, data: any, versions: string[]): Effect.Effect<AppConfig, Error | ValidationError[]>;
    deleteNamedConfig(applicationId: string, name: string): Effect.Effect<AppConfig, Error>;
}
export declare const ConfigService: Context.Tag<ConfigService, ConfigService>;
//# sourceMappingURL=ConfigService.d.ts.map