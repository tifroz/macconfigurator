import { configManager } from "./index.js";

// In memory configuration (great for testing / experimenting, data will not persist acrss restarts)
const inMemoryParams = {
  port: 4480,
  mountPath: "/configurator", // Can be changed to any path like "/config", "/api/config", etc.
  logger: {
    debug: (msg: string, ...args: any[]) => console.debug(`[DEBUG] ${msg}`, ...args),
    info: (msg: string, ...args: any[]) => console.info(`[INFO] ${msg}`, ...args),
    warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args),
    error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args),
    log: (msg: string, ...args: any[]) => console.log(`[LOG] ${msg}`, ...args),
  },
  admin: {
    username: "admin",
    password: "admin",
  },
  cacheControl: {
    maxAgeSeconds: 10,
    defaultMaxAgeSeconds: 60,
  },
};
await configManager.start(inMemoryParams);
console.info(`
  ConfigManager started on port ${inMemoryParams.port} (in memory)
  
  Navigate to http://localhost:${inMemoryParams.port}${inMemoryParams.mountPath}/admin to access the sandbox admin UI
  
  Use the following credentials:
  Username: ${inMemoryParams.admin.username}
  Password: ${inMemoryParams.admin.password}
  `);

// MongoDB configuration (data will persist across restarts)
/*const configManagerOptions = {
    port: 4480,
    mountPath: "/configurator",
    logger: {
      debug: (msg: string, ...args: any[]) => console.debug(`[DEBUG] ${msg}`, ...args),
      info: (msg: string, ...args: any[]) => console.info(`[INFO] ${msg}`, ...args),
      warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args),
      error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args),
      log: (msg: string, ...args: any[]) => console.log(`[LOG] ${msg}`, ...args),
    },
    admin: {
      username: "admin", // REPLACE WITH YOUR ADMIN USERNAME
      password: "admin", // REPLACE WITH YOUR ADMIN PASSWORD
    },
    mongodb: {
      host: settings.mongodb.host,
      port: settings.mongodb.port,
      collection: "app_configs",
      auth: {
        database: settings.mongodb.auth.database,
        user: settings.mongodb.auth.user,
        password: settings.mongodb.auth.password,
      },
    },
  };
  await configManager.start(configManagerOptions);
*/
