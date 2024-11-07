
# pg-deltakit

`pg-deltakit` is a Deno TypeScript library for managing PostgreSQL schemas. It allows you to define schemas, calculate differences between schema states, generate SQL migration queries, apply migrations, and create rollbacks. Perfect for synchronizing database schemas or managing database migrations programmatically.

## Features

- **Define Schemas**: Easily define schemas in code or load them directly from a PostgreSQL database.
- **Calculate Differences**: Identify and manage differences between two schema states.
- **Generate Migrations**: Automatically generate SQL queries to migrate from one schema to another and apply them to a PostgreSQL database.
- **Generate Rollbacks**: Create rollback queries to revert schema changes.

## Installation

To use `pg-deltakit`, import it directly into your Deno project:

```typescript
import { Schema, Diff } from 'https://raw.githubusercontent.com/cubicle-js/pg-deltakit/refs/heads/main/src/mod.ts';
```

## Usage

### 1. Define Schemas

You can create a schema by either loading it from an existing PostgreSQL database or defining it in code.

#### Load Schema from a Database

```typescript
const URI = 'postgresql://test_owner:PASSWORD@ep-southeast-2.aws.neon.tech/test?sslmode=require';
const schema1 = await Schema.fromDatabase(URI);
```

#### Define a Schema in Code

```typescript
const schema2 = new Schema({
  posts: {
    id: { type: 'varchar', primary: true, length: 36, nullable: false },
    title: 'text',
    body: { type: 'text', nullable: false, default: 'Hello, World!' },
    created_at: 'timestamp',
    updated_at: 'timestamp',
  },
  comments: {
    id: 'varchar',
    post: { type: 'varchar', references: 'posts' },
    body: 'text',
    created_at: 'timestamp',
    updated_at: 'timestamp',
  }
});
```

### 2. Calculate Differences

Use the `Diff` class to compare two schemas and generate a migration plan:

```typescript
const diff = new Diff(schema1, schema2);
```

### 3. Generate and Apply Migrations

Generate SQL migration queries to apply the differences between `schema1` and `schema2`:

```typescript
const migration = diff.getMigration();
const queries = await migration.apply(URI);
console.log('Migration applied:', queries);
```

### 4. Rollback Migrations

To reverse applied migrations, generate rollback queries:

```typescript
const rollback = diff.getRollback();
const rollbacks = rollback.toSQL();
console.log("ROLLBACK", rollbacks);

// Optionally apply rollback to the database
// await rollback.apply(URI);
```

## API Reference

### `Schema`

- **`Schema.fromDatabase(uri: string)`**: Loads a schema from a PostgreSQL database.
- **`new Schema(definition: object)`**: Creates a new schema from a JavaScript object.

### `Diff`

- **`new Diff(schema1: Schema, schema2: Schema)`**: Compares two schemas to calculate their differences.
- **`getMigration()`**: Returns a migration plan to transition from `schema1` to `schema2`.
- **`getRollback()`**: Returns a rollback plan to revert from `schema2` back to `schema1`.

### `Migration`

- **`apply(uri: string)`**: Applies the migration to a PostgreSQL database.
- **`toSQL()`**: Returns the SQL queries as a string for manual execution.

### `Rollback`

- **`apply(uri: string)`**: Applies the rollback to a PostgreSQL database.
- **`toSQL()`**: Returns the rollback SQL queries as a string.

## Example

```typescript
import { Schema, Diff } from 'https://raw.githubusercontent.com/cubicle-js/pg-deltakit/refs/heads/main/src/mod.ts';

const URI = 'postgresql://test_owner:PASSWORD@ep-southeast-2.aws.neon.tech/test?sslmode=require';
const schema1 = await Schema.fromDatabase(URI);

const schema2 = new Schema({
  posts: {
    id: { type: 'varchar', primary: true, length: 36, nullable: false },
    title: 'text',
    body: { type: 'text', nullable: false, default: 'Hello, World!' },
    created_at: 'timestamp',
    updated_at: 'timestamp',
  },
  comments: {
    id: 'varchar',
    post: { type: 'varchar', references: 'posts' },
    body: 'text',
    created_at: 'timestamp',
    updated_at: 'timestamp'
  }
});

const diff = new Diff(schema1, schema2);
const migration = diff.getMigration();
const queries = await migration.apply(URI);
console.log('Migration applied:', queries);

const rollback = diff.getRollback();
const rollbacks = rollback.toSQL();
console.log("ROLLBACK", rollbacks);
```

## License

This project is licensed under the [Your License Here].
