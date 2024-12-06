// src/mod.ts

// Re-export core modules
export { Schema } from "./core/schema.ts";
export { Diff } from "./core/diff.ts";

// Re-export types for external use
export type { SchemaDefinition, TableDefinition, ColumnDefinition, Client } from "./types/index.d.ts";

// Export constants or default configurations if needed
// export { CONFIG } from "./config.ts";
