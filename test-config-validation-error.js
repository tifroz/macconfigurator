#!/usr/bin/env node

// 168 Lines by Claude Sonnet
// Comprehensive test to reproduce ConfigValidationError with service layer integration

import { Effect, Layer, Context } from 'effect';
import { InMemoryConfigServiceLayer } from './dist/core/services/InMemoryConfigService.js';
import { ConfigStorageService } from './dist/core/services/ConfigStorageService.js';
import { ConfigValidationError, ApplicationNotFoundError } from './dist/core/types.js';
import { validateConfig } from './dist/core/validation/schemaValidator.js';

// Test schema and config from the issue
const testSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "appearance": {
      "type": "string",
      "enum": [
        "bare",
        "standard",
        "tizen"
      ]
    }
  },
  "required": [
    "appearance"
  ],
  "additionalProperties": true
};

const testConfig = {
  "appearance": "bare"
};

// Mock config for the service layer
const mockConfig = {
  port: 3000,
  logger: console,
  admin: {
    username: 'admin',
    password: 'admin'
  }
};

const ConfigManagerOptionsLayer = Layer.succeed(
  Context.GenericTag("ConfigManagerOptions"),
  mockConfig
);

async function testDirectValidation() {
  console.log('=== Testing Direct Validation Functions ===');
  
  console.log('\n1. Testing schema validation against meta-schema:');
  const schemaResult = await Effect.runPromise(
    validateConfig(testSchema, "https://json-schema.org/draft/2020-12/schema")
  );
  
  if (schemaResult.length === 0) {
    console.log('✅ Schema is valid');
  } else {
    console.log('❌ Schema validation failed:');
    schemaResult.forEach(error => console.log(`  - ${error.field}: ${error.message}`));
  }
  
  console.log('\n2. Testing config validation against schema:');
  const configResult = await Effect.runPromise(
    validateConfig(testConfig, testSchema)
  );
  
  if (configResult.length === 0) {
    console.log('✅ Config is valid');
  } else {
    console.log('❌ Config validation failed:');
    configResult.forEach(error => console.log(`  - ${error.field}: ${error.message}`));
  }
  
  return { schemaResult, configResult };
}

async function testServiceLayerValidation() {
  console.log('\n=== Testing Service Layer Validation ===');
  
  const program = Effect.gen(function* () {
    const service = yield* ConfigStorageService;
    
    // Test 1: Create application with valid schema and config
    console.log('\n3. Testing createApplication with valid data:');
    const validApp = {
      applicationId: 'test-app',
      archived: false,
      namedConfigs: {},
      defaultConfig: { data: testConfig },
      schema: testSchema,
      lastUpdated: new Date()
    };
    
    try {
      const result = yield* service.createApplication(validApp);
      console.log('✅ Application created successfully');
      console.log(`   Application ID: ${result.applicationId}`);
      return result;
    } catch (error) {
      console.log('❌ Application creation failed:', error);
      return null;
    }
  });
  
  try {
    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(InMemoryConfigServiceLayer),
        Effect.provide(ConfigManagerOptionsLayer)
      )
    );
    return result;
  } catch (error) {
    console.log('❌ Service layer test failed:', error);
    return null;
  }
}

async function testInvalidSchemaValidation() {
  console.log('\n=== Testing Invalid Schema Validation ===');
  
  const program = Effect.gen(function* () {
    const service = yield* ConfigStorageService;
    
    // Test with invalid schema
    console.log('\n4. Testing createApplication with invalid schema:');
    const invalidSchemaApp = {
      applicationId: 'test-app-invalid-schema',
      archived: false,
      namedConfigs: {},
      defaultConfig: { data: testConfig },
      schema: {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
          "appearance": {
            "type": "invalid-type", // Invalid type
            "enum": ["bare", "standard", "tizen"]
          }
        },
        "required": ["appearance"],
        "additionalProperties": true
      },
      lastUpdated: new Date()
    };
    
    const result = yield* service.createApplication(invalidSchemaApp);
    console.log('❌ Application creation should have failed but succeeded');
    return result;
  });
  
  try {
    await Effect.runPromise(
      program.pipe(
        Effect.provide(InMemoryConfigServiceLayer),
        Effect.provide(ConfigManagerOptionsLayer)
      )
    );
  } catch (error) {
    if (error._tag === 'ConfigValidationError') {
      console.log('✅ ConfigValidationError thrown correctly for invalid schema:');
      error.errors.forEach(err => console.log(`  - ${err.field}: ${err.message}`));
    } else {
      console.log('❌ Unexpected error type:', error._tag || error.constructor.name);
      console.log('Error details:', error);
    }
  }
}

async function testConfigAgainstInvalidSchema() {
  console.log('\n=== Testing Config Against Invalid Schema ===');
  
  const program = Effect.gen(function* () {
    const service = yield* ConfigStorageService;
    
    // Test with config that doesn't match schema
    console.log('\n5. Testing createApplication with config that doesn\'t match schema:');
    const mismatchedApp = {
      applicationId: 'test-app-mismatched',
      archived: false,
      namedConfigs: {},
      defaultConfig: { 
        data: {
          appearance: "invalid-appearance", // Not in enum
          extraField: "should be allowed due to additionalProperties"
        }
      },
      schema: testSchema,
      lastUpdated: new Date()
    };
    
    const result = yield* service.createApplication(mismatchedApp);
    console.log('❌ Application creation should have failed but succeeded');
    return result;
  });
  
  try {
    await Effect.runPromise(
      program.pipe(
        Effect.provide(InMemoryConfigServiceLayer),
        Effect.provide(ConfigManagerOptionsLayer)
      )
    );
  } catch (error) {
    if (error._tag === 'ConfigValidationError') {
      console.log('✅ ConfigValidationError thrown correctly for mismatched config:');
      error.errors.forEach(err => console.log(`  - ${err.field}: ${err.message} (value: ${JSON.stringify(err.value)})`));
    } else {
      console.log('❌ Unexpected error type:', error._tag || error.constructor.name);
      console.log('Error details:', error);
    }
  }
}

async function testComplexScenarios() {
  console.log('\n=== Testing Complex Scenarios ===');
  
  const program = Effect.gen(function* () {
    const service = yield* ConfigStorageService;
    
    // Test with empty schema
    console.log('\n6. Testing with empty schema:');
    const emptySchemaApp = {
      applicationId: 'test-empty-schema',
      archived: false,
      namedConfigs: {},
      defaultConfig: { data: {} },
      schema: {},
      lastUpdated: new Date()
    };
    
    try {
      const result = yield* service.createApplication(emptySchemaApp);
      console.log('✅ Empty schema application created successfully');
    } catch (error) {
      console.log('❌ Empty schema test failed:', error);
    }
    
    // Test with schema that has no $schema property
    console.log('\n7. Testing with schema without $schema property:');
    const noMetaSchemaApp = {
      applicationId: 'test-no-meta-schema',
      archived: false,
      namedConfigs: {},
      defaultConfig: { data: testConfig },
      schema: {
        "type": "object",
        "properties": {
          "appearance": {
            "type": "string",
            "enum": ["bare", "standard", "tizen"]
          }
        },
        "required": ["appearance"],
        "additionalProperties": true
      },
      lastUpdated: new Date()
    };
    
    try {
      const result = yield* service.createApplication(noMetaSchemaApp);
      console.log('✅ Schema without $schema property created successfully');
    } catch (error) {
      console.log('❌ Schema without $schema test failed:', error);
    }
  });
  
  try {
    await Effect.runPromise(
      program.pipe(
        Effect.provide(InMemoryConfigServiceLayer),
        Effect.provide(ConfigManagerOptionsLayer)
      )
    );
  } catch (error) {
    console.log('❌ Complex scenarios test failed:', error);
  }
}

async function runAllTests() {
  console.log('=== ConfigValidationError Comprehensive Test Suite ===');
  console.log('Testing the exact schema and configuration from the issue report\n');
  
  console.log('Schema:');
  console.log(JSON.stringify(testSchema, null, 2));
  console.log('\nConfiguration:');
  console.log(JSON.stringify(testConfig, null, 2));
  
  try {
    await testDirectValidation();
    await testServiceLayerValidation();
    await testInvalidSchemaValidation();
    await testConfigAgainstInvalidSchema();
    await testComplexScenarios();
    
    console.log('\n=== All Tests Complete ===');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

runAllTests().catch(console.error);