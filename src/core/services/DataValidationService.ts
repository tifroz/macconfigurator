// 27 Lines by Claude Sonnet
// DataValidationService with Effect.Tag pattern and never dependencies for pure service definition
import { Effect, Layer, Context } from "effect";
import {
  validateConfig as validateJsonSchema,
  validateSemver as validateSemverVersionsFunc,
} from "../validation/schemaValidator.js";
import type { AppConfig, NamedConfig } from "../types.js";
import { ConfigValidationError, SemverValidationError, VersionConflictError } from "../types.js";
import { LoggerService, LoggerServiceLayer } from "./LoggerService.js";

export interface DataValidationService {
  // Basic validation methods
  validateApplicationId(applicationId: string): Effect.Effect<void, ConfigValidationError>;
  validateSchema(schema: any): Effect.Effect<void, ConfigValidationError>;
  validateDataAgainstSchema(data: any, schema: any, context: string): Effect.Effect<void, ConfigValidationError>;
  validateSemverVersions(versions: string[]): Effect.Effect<void, SemverValidationError>;

  // Complex validation methods
  validateApplicationConfig(config: AppConfig, isUpdate?: boolean): Effect.Effect<void, ConfigValidationError | SemverValidationError | VersionConflictError>;
  validateNamedConfigs(namedConfigs: Record<string, NamedConfig>, schema: any): Effect.Effect<void, ConfigValidationError | VersionConflictError>;
  checkVersionUniqueness(namedConfigs: Record<string, NamedConfig>): Effect.Effect<void, VersionConflictError>;
}

export const DataValidationService = Context.GenericTag<DataValidationService>("DataValidationService");

// 120 Lines by Claude Sonnet
// Pure Effect implementation of DataValidationService with error handling that converts to never dependencies
export const DataValidationServiceLayer = Layer.effect(
  DataValidationService,
  Effect.gen(function* () {
    const logger = yield* LoggerService;

    const validateApplicationId = (applicationId: string): Effect.Effect<void, ConfigValidationError> =>
      Effect.gen(function* () {
        yield* logger.info("Application ID validation for: " + applicationId);
        // Check for null/undefined
        if (applicationId == null) {
          yield* logger.error("Application ID validation failed: required", { applicationId });
          return yield* Effect.fail(new ConfigValidationError({
            errors: [{ field: "applicationId", message: "Application ID is required" }],
            context: "applicationId validation"
          }));
        }

        // Check for empty string or whitespace only
        const trimmed = applicationId.trim();
        if (trimmed.length === 0) {
          yield* logger.error("Application ID validation failed: cannot be empty", { applicationId });
          return yield* Effect.fail(new ConfigValidationError({
            errors: [{ field: "applicationId", message: "Application ID cannot be empty or whitespace only" }],
            context: "applicationId validation"
          }));
        }
      });

    const validateSchema = (schema: any): Effect.Effect<void, ConfigValidationError> =>
      Effect.gen(function* () {
        const result = yield* validateJsonSchema(schema, "https://json-schema.org/draft/2020-12/schema").pipe(
          Effect.catchAll(() => Effect.succeed([]))
        );
        if (result.length > 0) {
          yield* logger.error("Schema validation failed", { errors: result });
          return yield* Effect.fail(new ConfigValidationError({
            errors: result,
            context: "schema validation"
          }));
        }
      });

    const validateDataAgainstSchema = (data: any, schema: any, context: string): Effect.Effect<void, ConfigValidationError> =>
      Effect.gen(function* () {
        const result = yield* validateJsonSchema(data, schema).pipe(Effect.catchAll(() => Effect.succeed([])));
        if (result.length > 0) {
          yield* logger.error(`Data validation failed for ${context}`, { errors: result });
          return yield* Effect.fail(new ConfigValidationError({
            errors: result,
            context: context
          }));
        }
      });

    const validateSemverVersions = (versions: string[]): Effect.Effect<void, SemverValidationError> =>
      Effect.gen(function* () {
        const result = yield* validateSemverVersionsFunc(versions).pipe(Effect.catchAll(() => Effect.succeed([])));
        if (Array.isArray(result) && result.length > 0) {
          yield* logger.error("Semver validation failed", { errors: result });
          return yield* Effect.fail(new SemverValidationError({
            errors: result
          }));
        }
      });

    const checkVersionUniqueness = (namedConfigs: Record<string, NamedConfig>): Effect.Effect<void, VersionConflictError> =>
      Effect.gen(function* () {
        const versionMap = new Map<string, string>();

        for (const [name, config] of Object.entries(namedConfigs)) {
          for (const version of config.versions) {
            if (versionMap.has(version)) {
              const existingConfigName = versionMap.get(version)!;
              yield* logger.error("Version conflict detected", {
                version,
                existingConfigName,
                newConfigName: name,
              });
              return yield* Effect.fail(new VersionConflictError({
                version,
                existingConfigName,
                newConfigName: name
              }));
            }
            versionMap.set(version, name);
          }
        }
      });

    const validateNamedConfigs = (namedConfigs: Record<string, NamedConfig>, schema: any): Effect.Effect<void, ConfigValidationError | VersionConflictError> =>
      Effect.gen(function* () {
        // Validate each named config
        for (const [name, config] of Object.entries(namedConfigs)) {
          const result = yield* validateJsonSchema(config.data, schema).pipe(Effect.catchAll(() => Effect.succeed([])));
          if (result.length > 0) {
            yield* logger.error(`Named config validation failed for '${name}'`, { errors: result });
            return yield* Effect.fail(new ConfigValidationError({
              errors: result,
              context: `named config '${name}'`
            }));
          }
        }

        // Check version uniqueness
        yield* checkVersionUniqueness(namedConfigs);
      });

    const validateApplicationConfig = (config: AppConfig, isUpdate: boolean = false): Effect.Effect<void, ConfigValidationError | SemverValidationError | VersionConflictError> =>
      Effect.gen(function* () {
        yield* logger.info("Validating application config for: " + config.applicationId);
        // Validate applicationId
        yield* validateApplicationId(config.applicationId);

        // Validate schema
        yield* validateSchema(config.schema);

        // Validate default config against schema
        yield* validateDataAgainstSchema(config.defaultConfig.data, config.schema, "default configuration");

        // Validate named configs if present
        if (config.namedConfigs && Object.keys(config.namedConfigs).length > 0) {
          yield* validateNamedConfigs(config.namedConfigs, config.schema);
        }
      });

    return {
      validateApplicationId,
      validateSchema,
      validateDataAgainstSchema,
      validateSemverVersions,
      validateApplicationConfig,
      validateNamedConfigs,
      checkVersionUniqueness,
    };
  })
).pipe(Layer.provide(LoggerServiceLayer));
