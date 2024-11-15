import { Diff, Schema, Client } from '../src/mod.ts';

const URI = Deno.env.get('DATABASE_URI');
const client = new Client(URI);
const schema1 = await Schema.fromDatabase(client);

const schema2 = new Schema({
  posts: {
    // id: 'varchar', // shorthand for { type: 'varchar' }
    id: { // long-hand
      type: 'varchar',
      primary: true,
      length: 36,
      // unique: true,
      // references: 'posts',
      nullable: false,
      // default: 'default value',
    },
    title: 'text',
    body: {
      type: 'text',
      nullable: false,
      default: `G'day mate!`,
    },
    created_at: 'timestamp',
    updated_at: 'timestamp',
  },
  comments: {
    id: 'varchar',
    post: {
      type: 'varchar',
      references: 'posts',
    },
    body: 'text',
    created_at: 'timestamp',
    updated_at: 'timestamp',
  },
  users: {
    id: {type: 'varchar', primary: true, length: 36},
    name: {type: 'text', default: null, nullable: true},
    email: 'text',
    mobile: 'text',
    created_at: 'timestamp',
    updated_at: 'timestamp',
  },
  profiles: {
    id: 'varchar',
    user: {
      type: 'varchar',
      references: 'users',
    },
    created_at: 'timestamp',
    updated_at: 'timestamp',
  },
});

const diff = new Diff(schema1, schema2);

const migration = diff.getMigration();
// console.log(migration.getOperations());
// console.log(migration.toSQL());
const queries = await migration.apply(client);
console.log('Migration applied', queries);

const rollback = diff.getRollback();
// console.log(rollback.getOperations());
const rollbacks = rollback.toSQL();
console.log("ROLLBACK", rollbacks);
// rollback.apply(URI);