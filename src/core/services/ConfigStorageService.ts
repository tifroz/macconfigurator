import { Effect, Context } from "effect";
import type { AppConfig, ConfigRequest, ConfigResponse, SharedValidationError, MongoDbError } from "../types.js";

export interface ConfigStorageService {
  // Application operations
  listApplications(): Effect.Effect<AppConfig[], MongoDbError | never>;
  getApplication(applicationId: string): Effect.Effect<AppConfig | null, MongoDbError | never>;
  createApplication(config: AppConfig): Effect.Effect<AppConfig, SharedValidationError | MongoDbError>;
  updateApplication(
    applicationId: string,
    config: Partial<AppConfig>
  ): Effect.Effect<AppConfig, SharedValidationError | MongoDbError>;
  archiveApplication(applicationId: string): Effect.Effect<void, SharedValidationError | MongoDbError>;
  unarchiveApplication(applicationId: string): Effect.Effect<void, SharedValidationError | MongoDbError>;

  // Config retrieval
  getConfig(request: ConfigRequest): Effect.Effect<ConfigResponse | null, MongoDbError | never>;

  // Named config operations
  createNamedConfig(
    applicationId: string,
    name: string,
    data: any,
    versions: string[]
  ): Effect.Effect<AppConfig, SharedValidationError | MongoDbError>;
  updateNamedConfig(
    applicationId: string,
    name: string,
    data: any,
    versions: string[]
  ): Effect.Effect<AppConfig, SharedValidationError | MongoDbError>;
  deleteNamedConfig(applicationId: string, name: string): Effect.Effect<AppConfig, SharedValidationError | MongoDbError>;
}

export const ConfigStorageService = Context.GenericTag<ConfigStorageService>("ConfigStorageService");
