import { Effect } from "effect";
import type { ValidationError } from "../types.js";
export declare function validateConfig(data: any, schema: any): Effect.Effect<ValidationError[], never>;
export declare function validateSemver(versions: string[]): Effect.Effect<ValidationError[], never>;
//# sourceMappingURL=schemaValidator.d.ts.map