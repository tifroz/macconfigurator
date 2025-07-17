// 15 Lines by Claude Opus
// In-memory implementation of ConfigStorageService for development/testing
import { Effect, Layer, Ref, Context } from "effect";
import type { AppConfig, ConfigRequest, ConfigResponse, ConfigManagerOptions, SharedValidationError, Logger } from "../types.js";
import { ConfigValidationError, ApplicationNotFoundError, ApplicationAlreadyExistsError, NamedConfigNotFoundError, NamedConfigAlreadyExistsError, SemverValidationError, VersionConflictError } from "../types.js";
import { ConfigStorageService } from "./ConfigStorageService.js";
import { validateConfig, validateSemver } from "../validation/schemaValidator.js";
import * as semver from "semver";

class InMemoryConfigServiceImpl implements ConfigStorageService {
  constructor(private readonly store: Ref.Ref<Map<string, AppConfig>>, logger: Logger) {
    // Logger parameter is available for future use
    void logger;
  }

  listApplications(): Effect.Effect<AppConfig[], never> {
    const self = this;
    return Effect.gen(function* () {
      const apps = yield* Ref.get(self.store);
      return Array.from(apps.values());
    });
  }

  getApplication(applicationId: string): Effect.Effect<AppConfig | null, never> {
    const self = this;
    return Effect.gen(function* () {
      const apps = yield* Ref.get(self.store);
      return apps.get(applicationId) || null;
    });
  }

  createApplication(config: AppConfig): Effect.Effect<AppConfig, SharedValidationError> {
    const self = this;
    return Effect.gen(function* () {
      // Validate schema
      const schemaErrors = yield* validateConfig(config.schema, "https://json-schema.org/draft/2020-12/schema");
      if (schemaErrors.length > 0) {
        return yield* Effect.fail(new ConfigValidationError({ errors: schemaErrors, context: "application schema" }));
      }

      // Validate default config against schema
      const configErrors = yield* validateConfig(config.defaultConfig.data, config.schema);
      if (configErrors.length > 0) {
        return yield* Effect.fail(new ConfigValidationError({ errors: configErrors, context: "default configuration" }));
      }

      // Check uniqueness
      const apps = yield* Ref.get(self.store);
      if (apps.has(config.applicationId)) {
        return yield* Effect.fail(new ApplicationAlreadyExistsError({ applicationId: config.applicationId }));
      }

      // Add to store
      const toInsert = { ...config, lastUpdated: new Date() };
      yield* Ref.update(self.store, (apps) => new Map(apps).set(config.applicationId, toInsert));

      return toInsert;
    });
  }

  updateApplication(
    applicationId: string,
    update: Partial<AppConfig>
  ): Effect.Effect<AppConfig, SharedValidationError> {
    const self = this;
    return Effect.gen(function* () {
      const existing = yield* self.getApplication(applicationId);
      if (!existing) {
        return yield* Effect.fail(new ApplicationNotFoundError({ applicationId }));
      }

      const updated = { ...existing, ...update, lastUpdated: new Date() };

      // Validate schema if updated
      if (update.schema) {
        const schemaErrors = yield* validateConfig(updated.schema, "https://json-schema.org/draft/2020-12/schema");
        if (schemaErrors.length > 0) {
          return yield* Effect.fail(new ConfigValidationError({ errors: schemaErrors, context: "application schema" }));
        }
      }

      // Validate all configs against schema
      if (update.schema || update.defaultConfig) {
        const configErrors = yield* validateConfig(updated.defaultConfig.data, updated.schema);
        if (configErrors.length > 0) {
          return yield* Effect.fail(new ConfigValidationError({ errors: configErrors, context: "default configuration" }));
        }
      }

      // Validate named configs
      if (update.schema || update.namedConfigs) {
        for (const [name, config] of Object.entries(updated.namedConfigs)) {
          const errors = yield* validateConfig(config.data, updated.schema);
          if (errors.length > 0) {
            return yield* Effect.fail(new ConfigValidationError({ 
              errors: errors.map((e) => ({ ...e, field: `namedConfigs.${name}.${e.field}` })),
              context: `named configuration '${name}'`
            }));
          }
        }
      }

      // Check version uniqueness
      const versionMap = new Map<string, string>();
      for (const [name, config] of Object.entries(updated.namedConfigs)) {
        for (const version of config.versions) {
          if (versionMap.has(version)) {
            return yield* Effect.fail(new VersionConflictError({ 
              version, 
              existingConfigName: versionMap.get(version)!, 
              newConfigName: name 
            }));
          }
          versionMap.set(version, name);
        }
      }

      yield* Ref.update(self.store, (apps) => new Map(apps).set(applicationId, updated));
      return updated;
    });
  }

  archiveApplication(applicationId: string): Effect.Effect<void, SharedValidationError> {
    const self = this;
    return Effect.gen(function* () {
      const app = yield* self.getApplication(applicationId);
      if (!app) {
        return yield* Effect.fail(new ApplicationNotFoundError({ applicationId }));
      }

      yield* self.updateApplication(applicationId, { archived: true });
    });
  }

  unarchiveApplication(applicationId: string): Effect.Effect<void, SharedValidationError> {
    const self = this;
    return Effect.gen(function* () {
      const app = yield* self.getApplication(applicationId);
      if (!app) {
        return yield* Effect.fail(new ApplicationNotFoundError({ applicationId }));
      }

      yield* self.updateApplication(applicationId, { archived: false });
    });
  }

  getConfig(request: ConfigRequest): Effect.Effect<ConfigResponse | null, never> {
    const self = this;
    return Effect.gen(function* () {
      const app = yield* self.getApplication(request.applicationId);
      if (!app || app.archived) {
        return null;
      }

      // Find matching named config by version
      for (const config of Object.values(app.namedConfigs)) {
        if (config.versions.some((v: string) => semver.satisfies(request.version, v))) {
          return {
            data: config.data,
            cacheControl: "max-age=600",
          };
        }
      }

      // Return default config if no match
      return {
        data: app.defaultConfig.data,
        cacheControl: "max-age=604800",
      };
    });
  }

  createNamedConfig(
    applicationId: string,
    name: string,
    data: any,
    versions: string[]
  ): Effect.Effect<AppConfig, SharedValidationError> {
    const self = this;
    return Effect.gen(function* () {
      const app = yield* self.getApplication(applicationId);
      if (!app) {
        return yield* Effect.fail(new ApplicationNotFoundError({ applicationId }));
      }

      if (app.namedConfigs[name]) {
        return yield* Effect.fail(new NamedConfigAlreadyExistsError({ applicationId, configName: name }));
      }

      // Validate versions
      const versionErrors = yield* validateSemver(versions);
      if (versionErrors.length > 0) {
        return yield* Effect.fail(new SemverValidationError({ errors: versionErrors }));
      }

      const update = {
        ...app,
        namedConfigs: {
          ...app.namedConfigs,
          [name]: { data, versions },
        },
      };

      return yield* self.updateApplication(applicationId, update);
    });
  }

  updateNamedConfig(
    applicationId: string,
    name: string,
    data: any,
    versions: string[]
  ): Effect.Effect<AppConfig, SharedValidationError> {
    const self = this;
    return Effect.gen(function* () {
      const app = yield* self.getApplication(applicationId);
      if (!app) {
        return yield* Effect.fail(new ApplicationNotFoundError({ applicationId }));
      }

      if (!app.namedConfigs[name]) {
        return yield* Effect.fail(new NamedConfigNotFoundError({ applicationId, configName: name }));
      }

      // Validate versions
      const versionErrors = yield* validateSemver(versions);
      if (versionErrors.length > 0) {
        return yield* Effect.fail(new SemverValidationError({ errors: versionErrors }));
      }

      const update = {
        ...app,
        namedConfigs: {
          ...app.namedConfigs,
          [name]: { data, versions },
        },
      };

      return yield* self.updateApplication(applicationId, update);
    });
  }

  deleteNamedConfig(applicationId: string, name: string): Effect.Effect<AppConfig, SharedValidationError> {
    const self = this;
    return Effect.gen(function* () {
      const app = yield* self.getApplication(applicationId);
      if (!app) {
        return yield* Effect.fail(new ApplicationNotFoundError({ applicationId }));
      }

      const { [name]: _, ...remainingConfigs } = app.namedConfigs;
      const update = {
        ...app,
        namedConfigs: remainingConfigs,
      };

      const result = yield* self.updateApplication(applicationId, update);
      return result;
    });
  }
}

// Create the service layer
export const InMemoryConfigServiceLayer = Layer.effect(
  ConfigStorageService,
  Effect.gen(function* () {
    const config = yield* Context.GenericTag<ConfigManagerOptions>("ConfigManagerOptions");
    const store = yield* Ref.make(new Map<string, AppConfig>());

    return new InMemoryConfigServiceImpl(store, config.logger);
  })
);
