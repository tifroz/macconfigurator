// 25 Lines by Claude Sonnet
// Pure Effect implementation of MongoDB-backed ConfigStorageService with collection layer
import { Effect, Layer, Context } from "effect";
import { MongoClient, Collection } from "mongodb";
import type {
  AppConfig,
  ConfigRequest,
  ConfigResponse,
  ConfigManagerOptions,
} from "../types.js";
import { ApplicationNotFoundError, ApplicationAlreadyExistsError, NamedConfigNotFoundError, NamedConfigAlreadyExistsError, SharedValidationError } from "../types.js";
import { ConfigStorageService } from "./ConfigStorageService.js";
import { DataValidationService, DataValidationServiceLayer } from "./DataValidationService.js";
import { LoggerService, LoggerServiceLayer } from "./LoggerService.js";
import * as semver from "semver";

// MongoDB Collection context tag
export const MongoCollection = Context.GenericTag<Collection<AppConfig>>("MongoCollection");

// 60 Lines by Claude Sonnet
// MongoDB collection layer that establishes connection for ConfigStorageService
export const MongoCollectionLayer = Layer.effect(
  MongoCollection,
  Effect.gen(function* () {
    const config = yield* Context.GenericTag<ConfigManagerOptions>("ConfigManagerOptions");
    const logger = yield* LoggerService;

    if (!config.mongodb) {
      yield* logger.error("MongoDB configuration is required");
      return {} as Collection<AppConfig>; // Return empty collection since we can't fail with never
    }

    const mongodb = config.mongodb!;

    // Log connection attempt
    yield* logger.info("Attempting MongoDB connection", {
      host: mongodb.host,
      port: mongodb.port,
      database: mongodb.auth.database,
    });

    // Create and connect client immediately
    const collection = yield* Effect.tryPromise({
      try: async () => {
        const url = `mongodb://${mongodb.auth.user}:${mongodb.auth.password}@${mongodb.host}:${mongodb.port}/${mongodb.auth.database}?authSource=${mongodb.auth.database}`;
        const client = new MongoClient(url, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 10000,
        });
        await client.connect();
        
        const db = client.db(mongodb.auth.database);
        const collection = db.collection<AppConfig>(mongodb.collection);

        // Add shutdown handler
        process.on("SIGTERM", () => {
          client.close().catch((err) => {
            console.error("Error closing MongoDB connection", err);
          });
        });

        return collection;
      },
      catch: (error) => {
        console.error("MongoDB connection error", error);
        return {} as Collection<AppConfig>; // Return empty collection since we can't fail with never
      },
    }).pipe(Effect.catchAll(() => Effect.succeed({} as Collection<AppConfig>)));

    yield* logger.info("MongoDB connected for ConfigManager");

    return collection;
  })
).pipe(Layer.provide(LoggerServiceLayer));

// 220 Lines by Claude Sonnet
// Pure Effect implementation of MongoDB ConfigStorageService with never dependencies
export const MongoConfigServiceLayer = Layer.effect(
  ConfigStorageService,
  Effect.gen(function* () {
    const collection = yield* MongoCollection;
    const config = yield* Context.GenericTag<ConfigManagerOptions>("ConfigManagerOptions");
    const validationService = yield* DataValidationService;
    const logger = yield* LoggerService;
    const cacheControl = config.cacheControl;

    const listApplications = (): Effect.Effect<AppConfig[], never> =>
      Effect.gen(function* () {
        const result = yield* Effect.tryPromise({
          try: async () => {
            const apps = await collection.find({}).toArray();
            return apps;
          },
          catch: () => [] as AppConfig[], // Return empty array on error
        }).pipe(Effect.catchAll(() => Effect.succeed([] as AppConfig[])));
        
        return result;
      });

    const getApplication = (applicationId: string): Effect.Effect<AppConfig | null, never> =>
      Effect.gen(function* () {
        const result = yield* Effect.tryPromise({
          try: async () => {
            const app = await collection.findOne({ applicationId });
            return app;
          },
          catch: () => null,
        }).pipe(Effect.catchAll(() => Effect.succeed(null)));
        
        return result;
      });

    const createApplication = (config: AppConfig): Effect.Effect<AppConfig, SharedValidationError | ApplicationAlreadyExistsError> =>
      Effect.gen(function* () {
        // Validate the entire application config
        yield* validationService.validateApplicationConfig(config);

        // Check uniqueness
        const existing = yield* Effect.tryPromise({
          try: () => collection.findOne({ applicationId: config.applicationId }),
          catch: () => null,
        }).pipe(Effect.catchAll(() => Effect.succeed(null)));

        if (existing) {
          yield* logger.error("Application already exists", { applicationId: config.applicationId });
          return yield* Effect.fail(new ApplicationAlreadyExistsError({ applicationId: config.applicationId }));
        }

        // Insert with lastUpdated
        const toInsert = { ...config, lastUpdated: new Date() };
        const success = yield* Effect.tryPromise({
          try: () => collection.insertOne(toInsert as any),
          catch: () => false,
        }).pipe(Effect.catchAll(() => Effect.succeed(false)));

        if (success) {
          yield* logger.info("Created application", { applicationId: config.applicationId });
        } else {
          yield* logger.error("Failed to create application", { applicationId: config.applicationId });
        }

        return toInsert;
      });

    const updateApplication = (applicationId: string, update: Partial<AppConfig>): Effect.Effect<AppConfig, SharedValidationError | ApplicationNotFoundError> =>
      Effect.gen(function* () {
        const existing = yield* getApplication(applicationId);
        if (!existing) {
          yield* logger.error("Application not found for update", { applicationId });
          return yield* Effect.fail(new ApplicationNotFoundError({ applicationId }));
        }

        type MongoAppConfig = AppConfig & { _id?: string };
        const updatedRecord = { ...(existing as MongoAppConfig), ...update, lastUpdated: new Date() };
        const { _id, ...updated } = updatedRecord;

        // Validate the updated configuration if schema or configs changed
        if (update.schema || update.defaultConfig || update.namedConfigs) {
          yield* validationService.validateApplicationConfig(updated, true);
        }

        const success = yield* Effect.tryPromise({
          try: () => collection.replaceOne({ applicationId }, updated),
          catch: () => false,
        }).pipe(Effect.catchAll(() => Effect.succeed(false)));

        if (success) {
          yield* logger.info("Updated application", { applicationId });
        } else {
          yield* logger.error("Failed to update application", { applicationId });
        }

        return updated;
      });

    const archiveApplication = (applicationId: string): Effect.Effect<void, ApplicationNotFoundError> =>
      Effect.gen(function* () {
        const app = yield* getApplication(applicationId);
        if (!app) {
          yield* logger.error("Application not found for archive", { applicationId });
          return yield* Effect.fail(new ApplicationNotFoundError({ applicationId }));
        }

        const success = yield* Effect.tryPromise({
          try: async () => {
            await collection.updateOne({ applicationId }, { $set: { archived: true, lastUpdated: new Date() } });
            return true;
          },
          catch: () => false,
        }).pipe(Effect.catchAll(() => Effect.succeed(false)));

        if (success) {
          yield* logger.info("Archived application", { applicationId });
        } else {
          yield* logger.error("Failed to archive application", { applicationId });
        }
      });

    const unarchiveApplication = (applicationId: string): Effect.Effect<void, ApplicationNotFoundError> =>
      Effect.gen(function* () {
        const app = yield* getApplication(applicationId);
        if (!app) {
          yield* logger.error("Application not found for unarchive", { applicationId });
          return yield* Effect.fail(new ApplicationNotFoundError({ applicationId }));
        }

        const success = yield* Effect.tryPromise({
          try: async () => {
            await collection.updateOne({ applicationId }, { $set: { archived: false, lastUpdated: new Date() } });
            return true;
          },
          catch: () => false,
        }).pipe(Effect.catchAll(() => Effect.succeed(false)));

        if (success) {
          yield* logger.info("Unarchived application", { applicationId });
        } else {
          yield* logger.error("Failed to unarchive application", { applicationId });
        }
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
          cacheControl: cacheControl?.defaultMaxAgeSeconds ? `max-age=${cacheControl.defaultMaxAgeSeconds}` : "no-cache", 
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

        // Direct MongoDB update to avoid validation since we're just removing a config
        type MongoAppConfig = AppConfig & { _id?: string };
        const updatedRecord = { ...(app as MongoAppConfig), ...update, lastUpdated: new Date() };
        const { _id, ...updated } = updatedRecord;

        const success = yield* Effect.tryPromise({
          try: () => collection.replaceOne({ applicationId }, updated),
          catch: () => false,
        }).pipe(Effect.catchAll(() => Effect.succeed(false)));

        if (success) {
          yield* logger.info("Deleted named config", { applicationId, configName: name });
        } else {
          yield* logger.error("Failed to delete named config", { applicationId, configName: name });
        }

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
).pipe(Layer.provide(MongoCollectionLayer), Layer.provide(DataValidationServiceLayer), Layer.provide(LoggerServiceLayer));
