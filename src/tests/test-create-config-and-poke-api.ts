// 95 Lines by Claude Sonnet
// Test script for configurator server - creates app, configs, and validates HTTP API endpoints

import { configManager } from "../index.js";
import http from "http";
import { setTimeout } from "timers/promises";

// Test configuration
const SERVER_PORT = 4481; // Use different port to avoid conflicts
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const MOUNT_PATH = "/configurator";
const BASE_URL = `${SERVER_URL}${MOUNT_PATH}`;

// Test data
const TEST_APP_ID = "app-test";
const TEST_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {},
  required: [],
  additionalProperties: true,
};
const DEFAULT_CONFIG = { foo: "default config" };
const NAMED_CONFIG = { foo: "named config" };
const VERSION = "1.0.0";
const NAMED_VERSION = "test";

// Basic auth credentials
const AUTH_HEADER = "Basic " + Buffer.from("admin:admin").toString("base64");

interface HttpResponse {
  statusCode: number;
  data: any;
}

async function log(message: string): Promise<void> {
  console.log(`[TEST] ${message}`);
}

async function makeRequest(path: string, method: string = "GET", body: any = null): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: SERVER_PORT,
      path: `${MOUNT_PATH}${path}`,
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: AUTH_HEADER,
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const result = data ? JSON.parse(data) : null;
          resolve({ statusCode: res.statusCode || 0, data: result });
        } catch (e) {
          resolve({ statusCode: res.statusCode || 0, data: data });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests(): Promise<void> {
  try {
    // Step 1: Start configurator server
    await log("Starting configurator server...");
    configManager.start({
      port: SERVER_PORT,
      mountPath: MOUNT_PATH,
      logger: {
        info: (msg: string) => console.log(`[SERVER] ${msg}`),
        error: (msg: string) => console.error(`[SERVER ERROR] ${msg}`),
        warn: (msg: string) => console.warn(`[SERVER WARN] ${msg}`),
        debug: (msg: string) => console.debug(`[SERVER DEBUG] ${msg}`),
        log: (msg: string) => console.log(`[SERVER LOG] ${msg}`),
      },
      admin: {
        username: "admin",
        password: "admin",
      },
      cacheControl: {
        maxAgeSeconds: 10,
        defaultMaxAgeSeconds: 60,
      },
    });

    // Give server time to start
    await setTimeout(2000);
    await log("Server started successfully");

    // Step 2 & 3: Create application with schema and valid default configuration
    await log(`Creating application '${TEST_APP_ID}' with schema and default config...`);
    const createAppResult = await makeRequest("/api/admin/applications", "POST", {
      applicationId: TEST_APP_ID,
      archived: false,
      namedConfigs: {},
      defaultConfig: { data: DEFAULT_CONFIG },
      schema: TEST_SCHEMA,
      lastUpdated: new Date().toISOString(),
    });

    if (createAppResult.statusCode !== 201) {
      throw new Error(
        `Failed to create application. Status: ${createAppResult.statusCode}, Data: ${JSON.stringify(
          createAppResult.data
        )}`
      );
    }
    await log("Application created successfully with schema-valid default configuration");

    // Step 4: Query config and verify default response
    await log(`Querying config for ${BASE_URL}/config/${TEST_APP_ID}/${VERSION}...`);
    const defaultConfigResult = await makeRequest(`/config/${TEST_APP_ID}/${VERSION}`, "GET");

    if (defaultConfigResult.statusCode !== 200) {
      throw new Error(
        `Failed to get default config. Status: ${defaultConfigResult.statusCode}, Data: ${JSON.stringify(
          defaultConfigResult.data
        )}`
      );
    }

    if (JSON.stringify(defaultConfigResult.data) !== JSON.stringify(DEFAULT_CONFIG)) {
      throw new Error(
        `Default config mismatch. Expected: ${JSON.stringify(DEFAULT_CONFIG)}, Got: ${JSON.stringify(
          defaultConfigResult.data
        )}`
      );
    }
    await log("Default configuration verified successfully");

    // Step 5: Create named version 'test' with configuration
    await log(`Creating named configuration '${NAMED_VERSION}' with config...`);
    const createNamedResult = await makeRequest(`/api/admin/applications/${TEST_APP_ID}/configs`, "POST", {
      name: NAMED_VERSION,
      data: NAMED_CONFIG,
      versions: [VERSION],
    });

    if (createNamedResult.statusCode !== 201) {
      throw new Error(
        `Failed to create named config. Status: ${createNamedResult.statusCode}, Data: ${JSON.stringify(
          createNamedResult.data
        )}`
      );
    }
    await log("Named configuration created successfully");

    // Step 6: Add version "1.0.0" to the "test" configuration (already done in creation)
    await log(`Version '${VERSION}' already associated with named config '${NAMED_VERSION}'`);

    // Step 7: Query config again and verify named response
    await log(`Querying config for ${BASE_URL}/config/${TEST_APP_ID}/${VERSION} (should return named config)...`);
    const namedConfigResult = await makeRequest(`/config/${TEST_APP_ID}/${VERSION}`, "GET");

    if (namedConfigResult.statusCode !== 200) {
      throw new Error(
        `Failed to get named config. Status: ${namedConfigResult.statusCode}, Data: ${JSON.stringify(
          namedConfigResult.data
        )}`
      );
    }

    if (JSON.stringify(namedConfigResult.data) !== JSON.stringify(NAMED_CONFIG)) {
      throw new Error(
        `Named config mismatch. Expected: ${JSON.stringify(NAMED_CONFIG)}, Got: ${JSON.stringify(
          namedConfigResult.data
        )}`
      );
    }
    await log("Named configuration verified successfully");

    await log("🎉 All tests passed successfully!");
  } catch (error: any) {
    await log(`❌ Test failed: ${error.message}`);
    process.exit(1);
  } finally {
    // Cleanup
    await log("Shutting down server...");
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));

// Run tests
runTests();
