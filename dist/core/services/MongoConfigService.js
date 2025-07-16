// 24 Lines by Claude Opus
// Implement MongoDB-backed ConfigStorageService with connection memoization using Effect Layer
import { Effect, Layer, Context } from "effect";
import { MongoClient } from "mongodb";
import { ConfigStorageService } from "./ConfigStorageService.js";
import { validateConfig, validateSemver } from "../validation/schemaValidator.js";
import * as semver from "semver";
class MongoConfigServiceImpl {
    collection;
    constructor(db, collection, logger) {
        this.collection = collection;
        // DB and logger parameters are available for future use
        void db;
        void logger;
    }
    listApplications() {
        return Effect.tryPromise({
            try: async () => {
                const apps = await this.collection.find({}).toArray();
                return apps;
            },
            catch: (error) => new Error(`Failed to list applications: ${error}`),
        });
    }
    getApplication(applicationId) {
        return Effect.tryPromise({
            try: async () => {
                const app = await this.collection.findOne({ applicationId });
                return app;
            },
            catch: (error) => new Error(`Failed to get application: ${error}`),
        });
    }
    createApplication(config) {
        // 10 Lines by Claude Opus
        // Validate and create new application with uniqueness check
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
            const existing = yield* Effect.tryPromise({
                try: () => self.collection.findOne({ applicationId: config.applicationId }),
                catch: (error) => new Error(`Database error: ${error}`),
            });
            if (existing) {
                return yield* Effect.fail(new Error(`Application ID '${config.applicationId}' already exists`));
            }
            // Insert with lastUpdated
            const toInsert = { ...config, lastUpdated: new Date() };
            yield* Effect.tryPromise({
                try: () => self.collection.insertOne(toInsert),
                catch: (error) => new Error(`Failed to create application: ${error}`),
            });
            return toInsert;
        });
    }
    updateApplication(applicationId, update) {
        // 15 Lines by Claude Opus
        // Update application with validation for schema and configs
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
            // Check version uniqueness across named configs
            const versionMap = new Map();
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
            yield* Effect.tryPromise({
                try: () => self.collection.replaceOne({ applicationId }, updated),
                catch: (error) => new Error(`Failed to update application: ${error}`),
            });
            return updated;
        });
    }
    archiveApplication(applicationId) {
        return Effect.tryPromise({
            try: async () => {
                await this.collection.updateOne({ applicationId }, { $set: { archived: true, lastUpdated: new Date() } });
            },
            catch: (error) => new Error(`Failed to archive application: ${error}`),
        });
    }
    unarchiveApplication(applicationId) {
        return Effect.tryPromise({
            try: async () => {
                await this.collection.updateOne({ applicationId }, { $set: { archived: false, lastUpdated: new Date() } });
            },
            catch: (error) => new Error(`Failed to unarchive application: ${error}`),
        });
    }
    getConfig(request) {
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
                if (config.versions.some((v) => semver.satisfies(request.version, v))) {
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
    createNamedConfig(applicationId, name, data, versions) {
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
    updateNamedConfig(applicationId, name, data, versions) {
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
    deleteNamedConfig(applicationId, name) {
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
// MongoDB connection layer with memoization
const MongoConnectionLayer = Layer.scoped(Context.GenericTag("MongoConnection"), Effect.gen(function* () {
    const config = yield* Context.GenericTag("ConfigManagerOptions");
    if (!config.mongodb) {
        return yield* Effect.fail(new Error("MongoDB configuration is required"));
    }
    const mongodb = config.mongodb;
    const client = yield* Effect.acquireRelease(Effect.tryPromise({
        try: async () => {
            const url = `mongodb://${mongodb.auth.user}:${mongodb.auth.password}@${mongodb.host}:${mongodb.port}/${mongodb.auth.database}`;
            const client = new MongoClient(url);
            await client.connect();
            config.logger.info("MongoDB connected for ConfigManager");
            return client;
        },
        catch: (error) => new Error(`MongoDB connection failed: ${error}`),
    }), (client) => Effect.promise(async () => {
        await client.close();
        config.logger.info("MongoDB disconnected for ConfigManager");
    }));
    const db = client.db(mongodb.auth.database);
    const collection = db.collection(mongodb.collection);
    return { db, collection };
}));
// Service layer (MongoDB connection is memoized internally via Layer.scoped)
export const MongoConfigServiceLayer = Layer.effect(ConfigStorageService, Effect.gen(function* () {
    const { db, collection } = yield* Context.GenericTag("MongoConnection");
    const config = yield* Context.GenericTag("ConfigManagerOptions");
    return new MongoConfigServiceImpl(db, collection, config.logger);
})).pipe(Layer.provide(MongoConnectionLayer));
//# sourceMappingURL=MongoConfigService.js.map