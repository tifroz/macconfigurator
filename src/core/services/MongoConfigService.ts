// 24 Lines by Claude Opus
// Implement MongoDB-backed ConfigStorageService with connection memoization using Effect Layer
import { Effect, Layer, Context } from "effect";
import { MongoClient, Db, Collection } from "mongodb";
import type { AppConfig, ConfigRequest, ConfigResponse, ConfigManagerOptions, SharedValidationError, MongoDbError, Logger, NamedConfig } from "../types.js";
import { ConfigValidationError, ApplicationNotFoundError, ApplicationAlreadyExistsError, NamedConfigNotFoundError, NamedConfigAlreadyExistsError, SemverValidationError, VersionConflictError, MongoNetworkError, MongoAuthError, UnexpectedServerError } from "../types.js";
import { ConfigStorageService } from "./ConfigStorageService.js";
import { validateConfig, validateSemver } from "../validation/schemaValidator.js";
import * as semver from "semver";

class MongoConfigServiceImpl implements ConfigStorageService {
  constructor(db: Db, private readonly collection: Collection<AppConfig>, logger: Logger) {
    // DB and logger parameters are available for future use
    void db;
    void logger;
  }

  listApplications(): Effect.Effect<AppConfig[], MongoDbError> {
    return Effect.tryPromise({
      try: async () => {
        const apps = await this.collection.find({}).toArray();
        return apps;
      },
      catch: (error) => new UnexpectedServerError({ message: `Failed to list applications: ${error}`, cause: error }),
    });
  }

  getApplication(applicationId: string): Effect.Effect<AppConfig | null, MongoDbError> {
    return Effect.tryPromise({
      try: async () => {
        const app = await this.collection.findOne({ applicationId });
        return app;
      },
      catch: (error) => new UnexpectedServerError({ message: `Failed to get application: ${error}`, cause: error }),
    });
  }

  createApplication(config: AppConfig): Effect.Effect<AppConfig, SharedValidationError | MongoDbError> {
    // 10 Lines by Claude Opus
    // Validate and create new application with uniqueness check
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
      const existing = yield* Effect.tryPromise({
        try: () => self.collection.findOne({ applicationId: config.applicationId }),
        catch: (error) => new UnexpectedServerError({ message: `Database error: ${error}`, cause: error }),
      });

      if (existing) {
        return yield* Effect.fail(new ApplicationAlreadyExistsError({ applicationId: config.applicationId }));
      }

      // Insert with lastUpdated
      const toInsert = { ...config, lastUpdated: new Date() };
      yield* Effect.tryPromise({
        try: () => self.collection.insertOne(toInsert as any),
        catch: (error) => new UnexpectedServerError({ message: `Failed to create application: ${error}`, cause: error }),
      });

      return toInsert;
    });
  }

  updateApplication(
    applicationId: string,
    update: Partial<AppConfig>
  ): Effect.Effect<AppConfig, SharedValidationError | MongoDbError> {
    // 15 Lines by Claude Opus
    // Update application with validation for schema and configs
    const self = this;
    return Effect.gen(function* () {
      const existing = yield* self.getApplication(applicationId);
      if (!existing) {
        return yield* Effect.fail(new ApplicationNotFoundError({ applicationId }));
      }

      // 3 Lines by Claude Opus
      // Remove _id from updated object to prevent MongoDB immutable field error
      const { _id, ...existingWithoutId } = existing as any;
      const updated = { ...existingWithoutId, ...update, lastUpdated: new Date() };

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
        for (const [name, config] of Object.entries(updated.namedConfigs) as [string, NamedConfig][]) {
          const errors = yield* validateConfig(config.data, updated.schema);
          if (errors.length > 0) {
            return yield* Effect.fail(new ConfigValidationError({ 
              errors: errors.map((e) => ({ ...e, field: `namedConfigs.${name}.${e.field}` })),
              context: `named configuration '${name}'`
            }));
          }
        }
      }

      // Check version uniqueness across named configs
      const versionMap = new Map<string, string>();
      for (const [name, config] of Object.entries(updated.namedConfigs) as [string, NamedConfig][]) {
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

      yield* Effect.tryPromise({
        try: () => self.collection.replaceOne({ applicationId }, updated),
        catch: (error) => new UnexpectedServerError({ message: `Failed to update application: ${error}`, cause: error }),
      });

      return updated;
    });
  }

  archiveApplication(applicationId: string): Effect.Effect<void, MongoDbError> {
    return Effect.tryPromise({
      try: async () => {
        await this.collection.updateOne({ applicationId }, { $set: { archived: true, lastUpdated: new Date() } });
      },
      catch: (error) => new UnexpectedServerError({ message: `Failed to archive application: ${error}`, cause: error }),
    });
  }

  unarchiveApplication(applicationId: string): Effect.Effect<void, MongoDbError> {
    return Effect.tryPromise({
      try: async () => {
        await this.collection.updateOne({ applicationId }, { $set: { archived: false, lastUpdated: new Date() } });
      },
      catch: (error) => new UnexpectedServerError({ message: `Failed to unarchive application: ${error}`, cause: error }),
    });
  }

  getConfig(request: ConfigRequest): Effect.Effect<ConfigResponse | null, MongoDbError> {
    // 12 Lines by Claude Opus
    // Get config by applicationId and version with semver matching
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
            cacheControl: "max-age=600", // 10 minutes for named configs
          };
        }
      }

      // Return default config if no match
      return {
        data: app.defaultConfig.data,
        cacheControl: "max-age=604800", // 7 days for default
      };
    });
  }

  createNamedConfig(
    applicationId: string,
    name: string,
    data: any,
    versions: string[]
  ): Effect.Effect<AppConfig, SharedValidationError | MongoDbError> {
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
  ): Effect.Effect<AppConfig, SharedValidationError | MongoDbError> {
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

  deleteNamedConfig(applicationId: string, name: string): Effect.Effect<AppConfig, SharedValidationError | MongoDbError> {
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

// 24 Lines by Claude Sonnet
// MongoDB connection layer that establishes connection immediately rather than as scoped resource
const MongoConnectionLayer = Layer.effect(
  Context.GenericTag<{ db: Db; collection: Collection<AppConfig>; client: MongoClient }>("MongoConnection"),
  Effect.gen(function* () {
    const config = yield* Context.GenericTag<ConfigManagerOptions>("ConfigManagerOptions");

    if (!config.mongodb) {
      return yield* Effect.fail(new UnexpectedServerError({ message: "MongoDB configuration is required" }));
    }

    const mongodb = config.mongodb!;
    
    // Create and connect client immediately
    const connectResult = yield* Effect.tryPromise({
      try: async () => {
        const url = `mongodb://${mongodb.auth.user}:${mongodb.auth.password}@${mongodb.host}:${mongodb.port}/${mongodb.auth.database}?authSource=${mongodb.auth.database}`;
        config.logger.info("Attempting MongoDB connection", { host: mongodb.host, port: mongodb.port, database: mongodb.auth.database });
        const client = new MongoClient(url, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 10000,
        });
        await client.connect();
        config.logger.info("MongoDB connected for ConfigManager");
        return client;
      },
      catch: (error) => {
        config.logger.error("MongoDB connection error", error);
        // Determine error type based on error message/code
        const errorStr = String(error);
        if (errorStr.includes("authentication failed") || errorStr.includes("auth")) {
          return new MongoAuthError({ message: `MongoDB authentication failed: ${error}`, cause: error });
        }
        if (errorStr.includes("ECONNREFUSED") || errorStr.includes("network")) {
          return new MongoNetworkError({ message: `MongoDB network error: ${error}`, cause: error });
        }
        return new UnexpectedServerError({ message: `MongoDB connection failed: ${error}`, cause: error });
      },
    });

    const db = connectResult.db(mongodb.auth.database);
    const collection = db.collection<AppConfig>(mongodb.collection);

    // Add shutdown handler
    process.on('SIGTERM', () => {
      connectResult.close().catch((err) => {
        config.logger.error("Error closing MongoDB connection", err);
      });
    });

    return { db, collection, client: connectResult };
  })
);

// 9 Lines by Claude Sonnet
// Service layer with non-scoped MongoDB connection
export const MongoConfigServiceLayer = Layer.effect(
  ConfigStorageService,
  Effect.gen(function* () {
    const { db, collection } = yield* Context.GenericTag<{ db: Db; collection: Collection<AppConfig>; client: MongoClient }>(
      "MongoConnection"
    );
    const config = yield* Context.GenericTag<ConfigManagerOptions>("ConfigManagerOptions");

    return new MongoConfigServiceImpl(db, collection, config.logger);
  })
).pipe(Layer.provide(MongoConnectionLayer));
