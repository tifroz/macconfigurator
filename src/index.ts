// 20 Lines by Claude Opus
// Main entry point for swishlyConfigManager package
import { Effect, Layer, Context } from "effect";
import express from "express";
import type { ConfigManagerOptions } from "./core/types.js";
import { ConfigStorageService } from "./core/services/ConfigStorageService.js";
import { MongoConfigServiceLayer } from "./core/services/MongoConfigService.js";
import { InMemoryConfigServiceLayer } from "./core/services/InMemoryConfigService.js";
import { createExpressApp } from "./server/app.js";
import http from "http";

export const configManager = {
  async start(options: ConfigManagerOptions): Promise<void> {
    // Create the config layer
    const configLayer = Layer.succeed(Context.GenericTag<ConfigManagerOptions>("ConfigManagerOptions"), options);

    // Create the appropriate service layer based on config
    const serviceLayer = options.mongodb ? MongoConfigServiceLayer : InMemoryConfigServiceLayer;

    // Build the complete layer
    const appLayer = Layer.provide(serviceLayer, configLayer);

    // Create program
    const program = Effect.gen(function* () {
      const service = yield* ConfigStorageService;

      // Create and start Express app
      const app = express();
      const configuratorApp = createExpressApp(options, service);
      app.use("/configurator", configuratorApp);
      const server = http.createServer(app);

      yield* Effect.promise(
        () =>
          new Promise<void>((resolve) => {
            server.listen(options.port, () => {
              options.logger.info(`ConfigManager started on port ${options.port}`);
              options.logger.info(`Admin UI available at http://localhost:${options.port}/configurator/admin`);
              options.logger.info(
                `Config API available at http://localhost:${options.port}/configurator/config/{applicationId}/{version}`
              );
              resolve();
            });
          })
      );

      // Handle graceful shutdown
      process.on("SIGTERM", () => {
        options.logger.info("SIGTERM received, shutting down gracefully");
        server.close(() => {
          options.logger.info("Server closed");
          process.exit(0);
        });
      });
    });

    // Run the program with the layer
    await program.pipe(Effect.provide(appLayer), Effect.runPromise);
  },
};
