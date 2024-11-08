// src/mod.ts

// Re-export core modules
export { Schema, Client } from "./core/schema.ts";
export { Diff } from "./core/diff.ts";

// Re-export types for external use
export type { SchemaDefinition, TableDefinition, ColumnDefinition } from "./types/index.d.ts";

// Export constants or default configurations if needed
export { DEFAULT_CONFIG } from "./config.ts";
