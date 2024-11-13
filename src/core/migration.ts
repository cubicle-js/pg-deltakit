import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { TransactionError } from "https://deno.land/x/postgres@v0.17.0/client/error.ts";

import type { Operation, Changes, ColumnDefinition } from "../types/index.d.ts";

//import { esc, escID } from 'https://raw.githubusercontent.com/cubicle-js/esc/ff643b1d230c4c8b694eff3a2752d957fbd4cf64/src/mod.ts';
import { quote } from '../../../esc/src/mod.ts';



/*
const operations = [
  {
    target: 'tables', // one of  'tables', 'columns', 'constraints'
    type: 'create', // one of 'create', 'drop', 'alter'
    name: 'users', // name of table, colunm, or constraint
  },
  {
    target: 'columns', // one of  'tables', 'columns', 'constraints'
    type: 'alter', // one of 'create', 'drop', 'alter'
    name: 'id', // name of table, colunm, or constraint
    changes: {
      from: { type: 'varchar', primary: true },
      to: { type: 'uuid', primary: true },
    }
  }
]
*/



export class Migration {
  protected operations: Operation[] = [];

  addOperation(operation: Operation): Migration {
    this.operations.push(operation);
    return this;
  }

  getOperations(): Operation[] {
    return this.operations;
  }

  reverse(): Migration {
    this.operations.reverse();
    return this;
  }
  
  async apply(client : Client) {
    const queries = this.toSQL();
    
    await client.connect();
    const transaction = await client.createTransaction("migration", {
      isolation_level: "serializable",
    });

    await transaction.begin();
    for (const query of queries) {
      try {
        await transaction.queryArray(query);
      }
      catch (e) {
        if (e instanceof TransactionError) {
          // await transaction.rollback();
          // await client.end(); 
          console.error('Migration failed:', e.message);
          console.error('Failing query:', query);
          throw e;
        }
      }
      // await transaction.queryArray(query);
    }
    await transaction.commit();
    await client.end(); 

    return queries;
  }

  toSQL(): string[] { 
    const queries: string[] = [];
    const queriesLast: string[] = [];

    for (const operation of this.operations) {
      const [ table, column ] = operation.name.split('.');

      // Tables
      if(operation.target === 'tables') {
        switch (operation.type) {
          case 'create': queries.push(`CREATE TABLE ${quote.id(operation.name)} ();`); break;
          case 'drop': queriesLast.push(`DROP TABLE ${quote.id(operation.name)};`); break;
        }
      }
      else {
        if (typeof operation.changes?.to === 'undefined' ) {
          throw new Error('Changes to column definition (changes.to) are required for target:columns and target:constraints');
        }

        // Columns
        if (operation.target === 'columns') {
          switch (operation.type) {
            case 'drop':
              queries.push(`ALTER TABLE ${quote.id(table)} DROP COLUMN ${quote.id(column)};`);
              break;
            case 'create':
              // Create Column
              queries.push((() => {
                const type = this._toSQLType(operation.changes.to);
                let query = `ALTER TABLE ${quote.id(table)} ADD COLUMN ${quote.id(column)} ${type}`;
                if (operation.changes.to?.nullable === false) { query += ' NOT NULL'; }
                if (operation.changes.to?.default != null) { 
                  // const defaultValue = operation.changes.to?.default.replace('"', '\\"');
                  query += ` DEFAULT ${quote.sql(operation.changes.to?.default)}`; 
                }
                query += ';';
                return query;
              })());
              break;
            case 'alter':
              const alter_queries = this._toSQLColumnHelper(table, column, operation.changes);
              if (alter_queries.length > 0) {
                queries.push(`ALTER TABLE ${quote.id(table)} ` + alter_queries.join(', '));
              }
          }
        }

        // Constraints
        const constraint_queries = this._toSQLConstraintHelper(table, column, operation.changes);
        if (constraint_queries.length > 0) {
          queries.push(`ALTER TABLE ${quote.id(table)} ` + constraint_queries.join(', '));
        }

      }
    }

    queries.push(...queriesLast);

    return queries;
  }

  _toSQLColumnHelper(table: string, column: string, changes: Changes) : string[] {
    const subqueries: string[] = [];

    const sqlTypes = {
      to: this._toSQLType(changes.to as Partial<ColumnDefinition>),
      from: this._toSQLType(changes.from as Partial<ColumnDefinition>),
    };
    if (sqlTypes.to !== sqlTypes.from) {
      subqueries.push(`SET TYPE ${sqlTypes.to}`);
    }

    if (quote.sql(changes.to?.default) !== quote.sql(changes.from?.default)) {
      if (changes.to?.default != null) {
        subqueries.push(`SET DEFAULT ${quote.sql(changes.to?.default)}`);
      }
      else if (changes.to?.default == null) {
        subqueries.push(`DROP DEFAULT`);
      }
    }
    
    if (changes.to?.nullable !== changes.from?.nullable) {
      if (changes.to?.nullable == true) {
        subqueries.push(`SET NOT NULL`);
      }
      else if (changes.to?.nullable == false) {
        subqueries.push(`DROP NOT NULL`);
      }
    }
    
    return subqueries.map((subquery) => {
      return `ALTER COLUMN ${quote.id(column)} ${subquery}`;
    });
  }

  _toSQLConstraintHelper(table: string, column: string, changes: Partial<Changes>) : string[] {
    const subqueries: string[] = [];

    if (changes.to?.primary !== changes.from?.primary) {
      const constraint_name = `${table}_${column}_primary`;
      if (changes.to?.primary == true) {
        subqueries.push(`ADD CONSTRAINT ${quote.id(constraint_name)} PRIMARY KEY (${quote.id(column)})`);
      }
      else if (typeof changes.from?.primary !== 'undefined' && changes.to?.primary == false) {
        subqueries.push(`DROP CONSTRAINT ${quote.id(constraint_name)}`);
      }
    }

    if (changes.to?.unique !== changes.from?.unique) {
      const constraint_name = `${table}_${column}_unique`;
      if (changes.to?.unique == true) {
        subqueries.push(`ADD CONSTRAINT ${quote.id(constraint_name)} UNIQUE (${quote.id(column)})`);
      }
      else if (typeof changes.from?.unique !== 'undefined' && changes.to?.unique == false) {
        subqueries.push(`DROP CONSTRAINT ${quote.id(constraint_name)}`);
      }
    }
   
    if (changes.to?.references !== changes.from?.references) {
      const constraint_name = `${table}_${column}_foreignkey`;
      
      if (changes.to?.references != null) {
        subqueries.push(`ADD CONSTRAINT ${quote.id(constraint_name)} FOREIGN KEY (${quote.id(column)}) REFERENCES ${quote.id(changes.to?.references)}`);
      }
      else if (typeof changes.to?.references === 'undefined') {
        subqueries.push(`DROP CONSTRAINT ${quote.id(constraint_name)}`);
      }
    }

    return subqueries;
  }

  _toSQLType(columnDefinition: Partial<ColumnDefinition>): string {
    return columnDefinition.type + (
      columnDefinition.length ? `(${columnDefinition.length})` : ''
    );
  }

}