// 11 Lines by Claude Opus
// JSON Schema and semver validation using Ajv with meta-schema support
import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import * as semver from "semver";
import { Effect } from "effect";
import type { ValidationError } from "../types.js";

const ajv = new Ajv2020({ allErrors: true, verbose: true });
addFormats(ajv);

export function validateConfig(data: any, schema: any): Effect.Effect<ValidationError[], never> {
  return Effect.sync(() => {
    // If schema is a string (URL), validate as meta-schema
    if (typeof schema === "string" && schema.startsWith("https://json-schema.org/")) {
      // Validate that data is a valid JSON Schema
      const valid = ajv.validateSchema(data);
      if (!valid && ajv.errors) {
        return ajv.errors.map(error => ({
          field: error.instancePath?.replace(/^\//, "") || error.schemaPath || "root",
          message: error.message || "Invalid JSON Schema",
          value: error.data
        }));
      }
      return [];
    }
    
    // Normal validation of data against schema
    const validate = ajv.compile(schema);
    const valid = validate(data);
    
    if (!valid && validate.errors) {
      return validate.errors.map(error => ({
        field: (error as any).instancePath?.replace(/^\//, "") || error.schemaPath || "root",
        message: error.message || "Validation failed",
        value: (error as any).data
      }));
    }
    
    return [];
  });
}

export function validateSemver(versions: string[]): Effect.Effect<ValidationError[], never> {
  return Effect.sync(() => {
    const errors: ValidationError[] = [];
    
    versions.forEach((version, index) => {
      if (!semver.valid(version)) {
        errors.push({
          field: `versions[${index}]`,
          message: `Invalid semver: ${version}`,
          value: version
        });
      }
    });
    
    return errors;
  });
}