// 15 Lines by Claude Opus
// In-memory implementation of ConfigStorageService for development/testing
import { Effect, Layer, Ref, Context } from "effect";
import type { AppConfig, ConfigRequest, ConfigResponse, ValidationError, ConfigManagerOptions } from "../types.js";
import { ConfigStorageService } from "./ConfigStorageService.js";
import { validateConfig, validateSemver } from "../validation/schemaValidator.js";
import * as semver from "semver";

class InMemoryConfigServiceImpl implements ConfigStorageService {
  constructor(private readonly store: Ref.Ref<Map<string, AppConfig>>, logger: any) {
    // Logger parameter is available for future use
    void logger;
  }

  listApplications(): Effect.Effect<AppConfig[], Error> {
    const self = this;
    return Effect.gen(function* () {
      const apps = yield* Ref.get(self.store);
      return Array.from(apps.values());
    });
  }

  getApplication(applicationId: string): Effect.Effect<AppConfig | null, Error> {
    const self = this;
    return Effect.gen(function* () {
      const apps = yield* Ref.get(self.store);
      return apps.get(applicationId) || null;
    });
  }

  createApplication(config: AppConfig): Effect.Effect<AppConfig, Error | ValidationError[]> {
    const self = this;
    return Effect.gen(function* () {
      // Validate schema
      const schemaErrors = yield* validateConfig(config.schema, "https://json-schema.org/draft/2020-12/schema");
      if (schemaErrors.length > 0) {
        return yield* Effect.fail(schemaErrors);
      }

      // Validate default config against schema
      const configErrors = yield* validateConfig(config.defaultConfig.data, config.schema);
      if (configErrors.length > 0) {
        return yield* Effect.fail(configErrors);
      }

      // Check uniqueness
      const apps = yield* Ref.get(self.store);
      if (apps.has(config.applicationId)) {
        return yield* Effect.fail(new Error(`Application ID '${config.applicationId}' already exists`));
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
  ): Effect.Effect<AppConfig, Error | ValidationError[]> {
    const self = this;
    return Effect.gen(function* () {
      const existing = yield* self.getApplication(applicationId);
      if (!existing) {
        return yield* Effect.fail(new Error(`Application '${applicationId}' not found`));
      }

      const updated = { ...existing, ...update, lastUpdated: new Date() };

      // Validate schema if updated
      if (update.schema) {
        const schemaErrors = yield* validateConfig(updated.schema, "https://json-schema.org/draft/2020-12/schema");
        if (schemaErrors.length > 0) {
          return yield* Effect.fail(schemaErrors);
        }
      }

      // Validate all configs against schema
      if (update.schema || update.defaultConfig) {
        const configErrors = yield* validateConfig(updated.defaultConfig.data, updated.schema);
        if (configErrors.length > 0) {
          return yield* Effect.fail(configErrors);
        }
      }

      // Validate named configs
      if (update.schema || update.namedConfigs) {
        for (const [name, config] of Object.entries(updated.namedConfigs)) {
          const errors = yield* validateConfig(config.data, updated.schema);
          if (errors.length > 0) {
            return yield* Effect.fail(errors.map((e) => ({ ...e, field: `namedConfigs.${name}.${e.field}` })));
          }
        }
      }

      // Check version uniqueness
      const versionMap = new Map<string, string>();
      for (const [name, config] of Object.entries(updated.namedConfigs)) {
        for (const version of config.versions) {
          if (versionMap.has(version)) {
            return yield* Effect.fail([
              {
                field: `namedConfigs.${name}.versions`,
                message: `Version ${version} is already used by config '${versionMap.get(version)}'`,
              },
            ]);
          }
          versionMap.set(version, name);
        }
      }

      yield* Ref.update(self.store, (apps) => new Map(apps).set(applicationId, updated));
      return updated;
    });
  }

  archiveApplication(applicationId: string): Effect.Effect<void, Error> {
    const self = this;
    return Effect.gen(function* () {
      const app = yield* self.getApplication(applicationId);
      if (!app) {
        return yield* Effect.fail(new Error(`Application '${applicationId}' not found`));
      }

      yield* self
        .updateApplication(applicationId, { archived: true })
        .pipe(Effect.mapError((e) => (Array.isArray(e) ? new Error(`Validation errors: ${JSON.stringify(e)}`) : e)));
    });
  }

  unarchiveApplication(applicationId: string): Effect.Effect<void, Error> {
    const self = this;
    return Effect.gen(function* () {
      const app = yield* self.getApplication(applicationId);
      if (!app) {
        return yield* Effect.fail(new Error(`Application '${applicationId}' not found`));
      }

      yield* self
        .updateApplication(applicationId, { archived: false })
        .pipe(Effect.mapError((e) => (Array.isArray(e) ? new Error(`Validation errors: ${JSON.stringify(e)}`) : e)));
    });
  }

  getConfig(request: ConfigRequest): Effect.Effect<ConfigResponse | null, Error> {
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
  ): Effect.Effect<AppConfig, Error | ValidationError[]> {
    const self = this;
    return Effect.gen(function* () {
      const app = yield* self.getApplication(applicationId);
      if (!app) {
        return yield* Effect.fail(new Error(`Application '${applicationId}' not found`));
      }

      if (app.namedConfigs[name]) {
        return yield* Effect.fail(new Error(`Named config '${name}' already exists`));
      }

      // Validate versions
      const versionErrors = yield* validateSemver(versions);
      if (versionErrors.length > 0) {
        return yield* Effect.fail(versionErrors);
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
  ): Effect.Effect<AppConfig, Error | ValidationError[]> {
    const self = this;
    return Effect.gen(function* () {
      const app = yield* self.getApplication(applicationId);
      if (!app) {
        return yield* Effect.fail(new Error(`Application '${applicationId}' not found`));
      }

      if (!app.namedConfigs[name]) {
        return yield* Effect.fail(new Error(`Named config '${name}' not found`));
      }

      // Validate versions
      const versionErrors = yield* validateSemver(versions);
      if (versionErrors.length > 0) {
        return yield* Effect.fail(versionErrors);
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

  deleteNamedConfig(applicationId: string, name: string): Effect.Effect<AppConfig, Error> {
    const self = this;
    return Effect.gen(function* () {
      const app = yield* self.getApplication(applicationId);
      if (!app) {
        return yield* Effect.fail(new Error(`Application '${applicationId}' not found`));
      }

      const { [name]: _, ...remainingConfigs } = app.namedConfigs;
      const update = {
        ...app,
        namedConfigs: remainingConfigs,
      };

      const result = yield* self
        .updateApplication(applicationId, update)
        .pipe(Effect.mapError((e) => (Array.isArray(e) ? new Error(`Validation errors: ${JSON.stringify(e)}`) : e)));
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
