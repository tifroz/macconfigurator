// 9 Lines by Claude Sonnet
// Pure Effect implementation of in-memory ConfigStorageService for development/testing
import { Effect, Layer, Ref, Context } from "effect";
import type { AppConfig, ConfigRequest, ConfigResponse, ConfigManagerOptions } from "../types.js";
import { ApplicationNotFoundError, ApplicationAlreadyExistsError, NamedConfigNotFoundError, NamedConfigAlreadyExistsError, SharedValidationError } from "../types.js";
import { ConfigStorageService } from "./ConfigStorageService.js";
import { DataValidationService, DataValidationServiceLayer } from "./DataValidationService.js";
import { LoggerService, LoggerServiceLayer } from "./LoggerService.js";
import * as semver from "semver";

// 180 Lines by Claude Sonnet
// Pure Effect implementation of InMemoryConfigService with never dependencies
export const InMemoryConfigServiceLayer = Layer.effect(
  ConfigStorageService,
  Effect.gen(function* () {
    const config = yield* Context.GenericTag<ConfigManagerOptions>("ConfigManagerOptions");
    const validationService = yield* DataValidationService;
    const logger = yield* LoggerService;
    const store = yield* Ref.make(new Map<string, AppConfig>());
    const cacheControl = config.cacheControl;

    const listApplications = (): Effect.Effect<AppConfig[], never> =>
      Effect.gen(function* () {
        const apps = yield* Ref.get(store);
        return Array.from(apps.values());
      });

    const getApplication = (applicationId: string): Effect.Effect<AppConfig | null, never> =>
      Effect.gen(function* () {
        const apps = yield* Ref.get(store);
        return apps.get(applicationId) || null;
      });

    const createApplication = (config: AppConfig): Effect.Effect<AppConfig, SharedValidationError | ApplicationAlreadyExistsError> =>
      Effect.gen(function* () {
        // Validate the entire application config
        yield* validationService.validateApplicationConfig(config);

        // Check uniqueness
        const apps = yield* Ref.get(store);
        if (apps.has(config.applicationId)) {
          yield* logger.error("Application already exists", { applicationId: config.applicationId });
          return yield* Effect.fail(new ApplicationAlreadyExistsError({ applicationId: config.applicationId }));
        }

        // Add to store
        const toInsert = { ...config, lastUpdated: new Date() };
        yield* Ref.update(store, (apps) => new Map(apps).set(config.applicationId, toInsert));
        yield* logger.info("Created application", { applicationId: config.applicationId });
        return toInsert;
      });

    const updateApplication = (applicationId: string, update: Partial<AppConfig>): Effect.Effect<AppConfig, SharedValidationError | ApplicationNotFoundError> =>
      Effect.gen(function* () {
        const existing = yield* getApplication(applicationId);
        if (!existing) {
          yield* logger.error("Application not found for update", { applicationId });
          return yield* Effect.fail(new ApplicationNotFoundError({ applicationId }));
        }

        const updated = { ...existing, ...update, lastUpdated: new Date() };

        // Validate the updated configuration if schema or configs changed
        if (update.schema || update.defaultConfig || update.namedConfigs) {
          yield* validationService.validateApplicationConfig(updated, true);
        }

        yield* Ref.update(store, (apps) => new Map(apps).set(applicationId, updated));
        yield* logger.info("Updated application", { applicationId });
        return updated;
      });

    const archiveApplication = (applicationId: string): Effect.Effect<void, ApplicationNotFoundError> =>
      Effect.gen(function* () {
        const app = yield* getApplication(applicationId);
        if (!app) {
          yield* logger.error("Application not found for archive", { applicationId });
          return yield* Effect.fail(new ApplicationNotFoundError({ applicationId }));
        }

        // Direct update without validation since we're only changing the archived flag
        const updated = { ...app, archived: true, lastUpdated: new Date() };
        yield* Ref.update(store, (apps) => new Map(apps).set(applicationId, updated));
        yield* logger.info("Archived application", { applicationId });
      });

    const unarchiveApplication = (applicationId: string): Effect.Effect<void, ApplicationNotFoundError> =>
      Effect.gen(function* () {
        const app = yield* getApplication(applicationId);
        if (!app) {
          yield* logger.error("Application not found for unarchive", { applicationId });
          return yield* Effect.fail(new ApplicationNotFoundError({ applicationId }));
        }

        // Direct update without validation since we're only changing the archived flag
        const updated = { ...app, archived: false, lastUpdated: new Date() };
        yield* Ref.update(store, (apps) => new Map(apps).set(applicationId, updated));
        yield* logger.info("Unarchived application", { applicationId });
      });

    const getConfig = (request: ConfigRequest): Effect.Effect<ConfigResponse | null, never> =>
      Effect.gen(function* () {
        const app = yield* getApplication(request.applicationId);
        if (!app || app.archived) {
          return null;
        }

        // Find matching named config by version
        for (const config of Object.values(app.namedConfigs)) {
          if (config.versions.some((v: string) => semver.satisfies(request.version, v))) {
            return {
              data: config.data,
              cacheControl: cacheControl?.maxAgeSeconds ? `max-age=${cacheControl.maxAgeSeconds}` : "no-cache",
            };
          }
        }

        // Return default config if no match
        return {
          data: app.defaultConfig.data,
          cacheControl: cacheControl?.defaultMaxAgeSeconds
            ? `max-age=${cacheControl.defaultMaxAgeSeconds}`
            : "no-cache",
        };
      });

    const createNamedConfig = (
      applicationId: string,
      name: string,
      data: any,
      versions: string[]
    ): Effect.Effect<AppConfig, SharedValidationError | ApplicationNotFoundError | NamedConfigAlreadyExistsError> =>
      Effect.gen(function* () {
        const app = yield* getApplication(applicationId);
        if (!app) {
          yield* logger.error("Application not found for named config creation", { applicationId });
          return yield* Effect.fail(new ApplicationNotFoundError({ applicationId }));
        }

        if (app.namedConfigs[name]) {
          yield* logger.error("Named config already exists", { applicationId, configName: name });
          return yield* Effect.fail(new NamedConfigAlreadyExistsError({ applicationId, configName: name }));
        }

        // Validate versions
        yield* validationService.validateSemverVersions(versions);

        const update = {
          ...app,
          namedConfigs: {
            ...app.namedConfigs,
            [name]: { data, versions },
          },
        };

        const result = yield* updateApplication(applicationId, update);
        yield* logger.info("Created named config", { applicationId, configName: name });
        return result;
      });

    const updateNamedConfig = (
      applicationId: string,
      name: string,
      data: any,
      versions: string[]
    ): Effect.Effect<AppConfig, SharedValidationError | ApplicationNotFoundError | NamedConfigNotFoundError> =>
      Effect.gen(function* () {
        const app = yield* getApplication(applicationId);
        if (!app) {
          yield* logger.error("Application not found for named config update", { applicationId });
          return yield* Effect.fail(new ApplicationNotFoundError({ applicationId }));
        }

        if (!app.namedConfigs[name]) {
          yield* logger.error("Named config not found for update", { applicationId, configName: name });
          return yield* Effect.fail(new NamedConfigNotFoundError({ applicationId, configName: name }));
        }

        // Validate versions
        yield* validationService.validateSemverVersions(versions);

        const update = {
          ...app,
          namedConfigs: {
            ...app.namedConfigs,
            [name]: { data, versions },
          },
        };

        const result = yield* updateApplication(applicationId, update);
        yield* logger.info("Updated named config", { applicationId, configName: name });
        return result;
      });

    const deleteNamedConfig = (applicationId: string, name: string): Effect.Effect<AppConfig, ApplicationNotFoundError | NamedConfigNotFoundError> =>
      Effect.gen(function* () {
        const app = yield* getApplication(applicationId);
        if (!app) {
          yield* logger.error("Application not found for named config deletion", { applicationId });
          return yield* Effect.fail(new ApplicationNotFoundError({ applicationId }));
        }

        if (!app.namedConfigs[name]) {
          yield* logger.error("Named config not found for deletion", { applicationId, configName: name });
          return yield* Effect.fail(new NamedConfigNotFoundError({ applicationId, configName: name }));
        }

        const { [name]: _, ...remainingConfigs } = app.namedConfigs;
        const update = {
          ...app,
          namedConfigs: remainingConfigs,
        };

        // Use direct update to avoid validation since we're just removing a config
        const updated = { ...update, lastUpdated: new Date() };
        yield* Ref.update(store, (apps) => new Map(apps).set(applicationId, updated));
        yield* logger.info("Deleted named config", { applicationId, configName: name });
        return updated;
      });

    return {
      listApplications,
      getApplication,
      createApplication,
      updateApplication,
      archiveApplication,
      unarchiveApplication,
      getConfig,
      createNamedConfig,
      updateNamedConfig,
      deleteNamedConfig,
    };
  })
).pipe(Layer.provide(DataValidationServiceLayer), Layer.provide(LoggerServiceLayer));
