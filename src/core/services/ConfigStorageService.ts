// 35 Lines by Claude Sonnet
// ConfigStorageService interface with never dependencies for pure service definition
import { Effect, Context } from "effect";
import type { AppConfig, ConfigRequest, ConfigResponse, SharedValidationError, ApplicationNotFoundError, ApplicationAlreadyExistsError, NamedConfigNotFoundError, NamedConfigAlreadyExistsError } from "../types.js";

export interface ConfigStorageService {
  // Application operations
  listApplications(): Effect.Effect<AppConfig[], never>;
  getApplication(applicationId: string): Effect.Effect<AppConfig | null, never>;
  createApplication(config: AppConfig): Effect.Effect<AppConfig, SharedValidationError | ApplicationAlreadyExistsError>;
  updateApplication(
    applicationId: string,
    config: Partial<AppConfig>
  ): Effect.Effect<AppConfig, SharedValidationError | ApplicationNotFoundError>;
  archiveApplication(applicationId: string): Effect.Effect<void, ApplicationNotFoundError>;
  unarchiveApplication(applicationId: string): Effect.Effect<void, ApplicationNotFoundError>;

  // Config retrieval
  getConfig(request: ConfigRequest): Effect.Effect<ConfigResponse | null, never>;

  // Named config operations
  createNamedConfig(
    applicationId: string,
    name: string,
    data: any,
    versions: string[]
  ): Effect.Effect<AppConfig, SharedValidationError | ApplicationNotFoundError | NamedConfigAlreadyExistsError>;
  updateNamedConfig(
    applicationId: string,
    name: string,
    data: any,
    versions: string[]
  ): Effect.Effect<AppConfig, SharedValidationError | ApplicationNotFoundError | NamedConfigNotFoundError>;
  deleteNamedConfig(applicationId: string, name: string): Effect.Effect<AppConfig, ApplicationNotFoundError | NamedConfigNotFoundError>;
}

export const ConfigStorageService = Context.GenericTag<ConfigStorageService>("ConfigStorageService");
