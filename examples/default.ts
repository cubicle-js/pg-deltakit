import { Diff, Schema } from '../src/mod.ts';

const URI = 'postgresql://test_owner:PASSWORD@ep-sparkling-poetry-a7pov7jr.ap-southeast-2.aws.neon.tech/test?sslmode=require';
const schema1 = await Schema.fromDatabase(URI);

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
      default: 'Hello, World!',
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
  }
});

const diff = new Diff(schema1, schema2);

const migration = diff.getMigration();
// console.log(migration.getOperations());
const queries = await migration.apply(URI);
console.log('Migration applied', queries);

const rollback = diff.getRollback();
// console.log(rollback.getOperations());
const rollbacks = rollback.toSQL();
// console.log("ROLLBACK", rollbacks);
// rollback.apply(URI);