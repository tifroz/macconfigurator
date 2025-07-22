// 26 Lines by Claude Sonnet
// LoggerService with Effect.Tag pattern and pure service implementation
import { Effect, Layer, Context } from "effect";
import type { ConfigManagerOptions } from "../types.js";

export interface LoggerService {
  debug(message: string, ...args: any[]): Effect.Effect<void, never>;
  info(message: string, ...args: any[]): Effect.Effect<void, never>;
  warn(message: string, ...args: any[]): Effect.Effect<void, never>;
  error(message: string, ...args: any[]): Effect.Effect<void, never>;
  log(message: string, ...args: any[]): Effect.Effect<void, never>;
}

export const LoggerService = Context.GenericTag<LoggerService>("LoggerService");

// Live implementation layer
export const LoggerServiceLayer = Layer.effect(
  LoggerService,
  Effect.gen(function* () {
    const config = yield* Context.GenericTag<ConfigManagerOptions>("ConfigManagerOptions");
    const logger = config.logger;

    return {
      debug: (message: string, ...args: any[]) => Effect.sync(() => logger.debug(message, ...args)),
      info: (message: string, ...args: any[]) => Effect.sync(() => logger.info(message, ...args)),
      warn: (message: string, ...args: any[]) => Effect.sync(() => logger.warn(message, ...args)),
      error: (message: string, ...args: any[]) => Effect.sync(() => logger.error(message, ...args)),
      log: (message: string, ...args: any[]) => Effect.sync(() => logger.log(message, ...args)),
    };
  })
);