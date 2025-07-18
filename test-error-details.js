#!/usr/bin/env node

// 98 Lines by Claude Sonnet
// Targeted test to extract and analyze ConfigValidationError details

import { Effect, Layer, Context } from 'effect';
import { InMemoryConfigServiceLayer } from './dist/core/services/InMemoryConfigService.js';
import { ConfigStorageService } from './dist/core/services/ConfigStorageService.js';
import { ConfigValidationError } from './dist/core/types.js';

const testSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "appearance": {
      "type": "string",
      "enum": ["bare", "standard", "tizen"]
    }
  },
  "required": ["appearance"],
  "additionalProperties": true
};

const testConfig = {
  "appearance": "bare"
};

const mockConfig = {
  port: 3000,
  logger: console,
  admin: { username: 'admin', password: 'admin' }
};

const ConfigManagerOptionsLayer = Layer.succeed(
  Context.GenericTag("ConfigManagerOptions"),
  mockConfig
);

function extractErrorDetails(error) {
  console.log('Error type:', error.constructor.name);
  console.log('Error _tag:', error._tag);
  console.log('Error message:', error.message);
  console.log('Error stack:', error.stack);
  
  if (error.cause && error.cause._tag === 'ConfigValidationError') {
    console.log('Found ConfigValidationError in cause:');
    console.log('  - errors:', error.cause.errors);
    return error.cause;
  }
  
  if (error._tag === 'ConfigValidationError') {
    console.log('Direct ConfigValidationError:');
    console.log('  - errors:', error.errors);
    return error;
  }
  
  return null;
}

async function testInvalidSchemaDetailed() {
  console.log('=== Testing Invalid Schema (Detailed) ===');
  
  const program = Effect.gen(function* () {
    const service = yield* ConfigStorageService;
    
    const invalidSchemaApp = {
      applicationId: 'test-invalid-schema',
      archived: false,
      namedConfigs: {},
      defaultConfig: { data: testConfig },
      schema: {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
          "appearance": {
            "type": "invalid-type", // This should fail schema validation
            "enum": ["bare", "standard", "tizen"]
          }
        },
        "required": ["appearance"],
        "additionalProperties": true
      },
      lastUpdated: new Date()
    };
    
    return yield* service.createApplication(invalidSchemaApp);
  });
  
  try {
    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(InMemoryConfigServiceLayer),
        Effect.provide(ConfigManagerOptionsLayer)
      )
    );
    console.log('❌ Should have failed but succeeded');
  } catch (error) {
    console.log('✅ Error caught, analyzing details:');
    const validationError = extractErrorDetails(error);
    if (validationError) {
      console.log('ConfigValidationError details:');
      validationError.errors.forEach(err => {
        console.log(`  - Field: ${err.field}`);
        console.log(`    Message: ${err.message}`);
        console.log(`    Value: ${JSON.stringify(err.value)}`);
      });
    }
  }
}

async function testInvalidConfigDetailed() {
  console.log('\n=== Testing Invalid Config (Detailed) ===');
  
  const program = Effect.gen(function* () {
    const service = yield* ConfigStorageService;
    
    const invalidConfigApp = {
      applicationId: 'test-invalid-config',
      archived: false,
      namedConfigs: {},
      defaultConfig: { 
        data: {
          appearance: "invalid-appearance", // Not in enum
          extraField: "allowed"
        }
      },
      schema: testSchema,
      lastUpdated: new Date()
    };
    
    return yield* service.createApplication(invalidConfigApp);
  });
  
  try {
    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(InMemoryConfigServiceLayer),
        Effect.provide(ConfigManagerOptionsLayer)
      )
    );
    console.log('❌ Should have failed but succeeded');
  } catch (error) {
    console.log('✅ Error caught, analyzing details:');
    const validationError = extractErrorDetails(error);
    if (validationError) {
      console.log('ConfigValidationError details:');
      validationError.errors.forEach(err => {
        console.log(`  - Field: ${err.field}`);
        console.log(`    Message: ${err.message}`);
        console.log(`    Value: ${JSON.stringify(err.value)}`);
      });
    }
  }
}

async function testValidScenario() {
  console.log('\n=== Testing Valid Scenario ===');
  
  const program = Effect.gen(function* () {
    const service = yield* ConfigStorageService;
    
    const validApp = {
      applicationId: 'test-valid',
      archived: false,
      namedConfigs: {},
      defaultConfig: { data: testConfig },
      schema: testSchema,
      lastUpdated: new Date()
    };
    
    return yield* service.createApplication(validApp);
  });
  
  try {
    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(InMemoryConfigServiceLayer),
        Effect.provide(ConfigManagerOptionsLayer)
      )
    );
    console.log('✅ Valid scenario succeeded');
    console.log('Application ID:', result.applicationId);
  } catch (error) {
    console.log('❌ Valid scenario failed:');
    extractErrorDetails(error);
  }
}

async function runDetailedTests() {
  console.log('=== Detailed ConfigValidationError Analysis ===');
  
  await testValidScenario();
  await testInvalidSchemaDetailed();
  await testInvalidConfigDetailed();
  
  console.log('\n=== Analysis Complete ===');
}

runDetailedTests().catch(console.error);