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

// Logger interface inspired by the console object
export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  log(message: string, ...args: any[]): void;
}

export interface CacheControl {
  defaultMaxAgeSeconds: number;
  maxAgeSeconds: number;
}

export interface ConfigManagerOptions {
  port: number;
  mountPath?: string; // Base path for mounting the app (defaults to '/configurator')
  logger: Logger;
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
  cacheControl?: CacheControl;
}

// 50 Lines by Claude Sonnet
// Tagged error types for granular error handling using Effect best practices
import { Data } from "effect";

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Shared validation error types for both services
export class ConfigValidationError extends Data.TaggedError("ConfigValidationError")<{
  errors: ValidationError[];
  context?: string;
}> {}

export class ApplicationNotFoundError extends Data.TaggedError("ApplicationNotFoundError")<{
  applicationId: string;
}> {}

export class ApplicationAlreadyExistsError extends Data.TaggedError("ApplicationAlreadyExistsError")<{
  applicationId: string;
}> {}

export class NamedConfigNotFoundError extends Data.TaggedError("NamedConfigNotFoundError")<{
  applicationId: string;
  configName: string;
}> {}

export class NamedConfigAlreadyExistsError extends Data.TaggedError("NamedConfigAlreadyExistsError")<{
  applicationId: string;
  configName: string;
}> {}

export class SemverValidationError extends Data.TaggedError("SemverValidationError")<{
  errors: ValidationError[];
}> {}

export class VersionConflictError extends Data.TaggedError("VersionConflictError")<{
  version: string;
  existingConfigName: string;
  newConfigName: string;
}> {}

// MongoDB-specific error types
export class MongoNetworkError extends Data.TaggedError("MongoNetworkError")<{
  message: string;
  cause?: unknown;
}> {}

export class MongoAuthError extends Data.TaggedError("MongoAuthError")<{
  message: string;
  cause?: unknown;
}> {}

export class WriteConflictError extends Data.TaggedError("WriteConflictError")<{
  message: string;
  cause?: unknown;
}> {}

export class PoolExhaustedError extends Data.TaggedError("PoolExhaustedError")<{
  message: string;
  cause?: unknown;
}> {}

export class UnexpectedServerError extends Data.TaggedError("UnexpectedServerError")<{
  message: string;
  cause?: unknown;
}> {}

// Error type unions
export type SharedValidationError =
  | ConfigValidationError
  | ApplicationNotFoundError
  | ApplicationAlreadyExistsError
  | NamedConfigNotFoundError
  | NamedConfigAlreadyExistsError
  | SemverValidationError
  | VersionConflictError;

export type MongoDbError =
  | MongoNetworkError
  | MongoAuthError
  | WriteConflictError
  | PoolExhaustedError
  | UnexpectedServerError;

export type ConfigServiceError = SharedValidationError | MongoDbError;

export interface ConfigRequest {
  applicationId: string;
  version: string;
}

export interface ConfigResponse {
  data: any;
  cacheControl: string;
}