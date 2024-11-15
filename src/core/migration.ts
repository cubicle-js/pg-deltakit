import { Client, TransactionError } from "./client.ts";
import { Utils } from "./utils.ts";

import type { Operation, Changes, ColumnDefinition } from "../types/index.d.ts";

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
  protected operations: { [key: string]: Operation[]; } = {
    "create.tables": [],
    "create.columns": [],
    "drop.constraints": [],
    "alter.columns": [],
    "alter.constraints": [],
    "create.constraints": [],
    "drop.columns": [],
    "drop.tables": [],
  }

  /**
   * Add an operation to the migration
   * @param operation Operation
   * @returns Migration
   * 
   * We need to ensure that operations are carried out in order.
   * The simplest way to solve this is to manually add operations by "type".
   * 
   * The order SHOULD be:
   * 1. Create Tables
   * 2. Create Columns
   * 3. Drop Constraints
   * 4. Alter Columns
   * 5. Alter Constraints 
   * 6. Create Constraints 
   * 7. Drop Columns
   * 8. Drop Tables
   *       
   * Note: altering a column that had a constraint might require dropping the contraint first and adding it back.
   * The only great to do that is for operations to be aware of what they depend on. Small rewrite required.
   */
  addOperation(operation: Operation): Migration {
    const operationKey = `${operation.type}.${operation.target}`;
    this.operations[operationKey].push(operation);
    return this;
  }

  getOperations(): Operation[] {
    // console.log(Object.values(this.operations));
    return Utils.combine(... Object.values(this.operations)) as Operation[];
  }

  reverse(): Migration {
    this.getOperations().reverse();
    return this;
  }
  
  async apply(client : Client) {
    const queries = this.toSQL();
    
    try {
      await client.connect();
      const transaction = await client.createTransaction("migration", {
        isolation_level: "serializable",
      });

      await transaction.begin();
      for (const query of queries) {
        try {
          await transaction.queryArray(query); // Attempt to execute the query
        } 
        catch (e) {
          e.cause.query = query;
          throw new Error(e.message, e);
        }
      }
      await transaction.commit(); // Commit the transaction if all queries succeed
    } catch (e) {
      console.error(`Transaction failed: ${e.message}`);
      console.error(`Query failed: ${e.cause.query}`);
      console.error(`Caused by: ${e.cause.message}`);
      throw e;
    } finally {
      await client.end(); // Ensure the client connection is closed
    }

    return queries;
  }

  toSQL(): string[] { 
    const queries: string[] = [];
    const queriesLast: string[] = [];

    for (const operation of this.getOperations()) {
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

    if (
      (typeof(changes.to?.default) === 'undefined') &&
      (typeof(changes.from?.default) !== 'undefined') 
    ) {
        subqueries.push(`DROP DEFAULT`);
    }
    else if (
      !(changes.to?.default == null && changes.from?.default == null) && (
        (typeof(changes.from?.default) === 'undefined') || 
        (changes.from?.default == null) || 
        (changes.to?.default == null) || 
        (quote.sql(changes.to?.default) !== quote.sql(changes.from?.default))
      )
     ) {
      if (changes.to?.default == null) {
        subqueries.push(`SET DEFAULT NULL`);
      } else {
        subqueries.push(`SET DEFAULT ${quote.sql(changes.to?.default)}`);
      }
    }
    
    if (changes.to?.nullable !== changes.from?.nullable) {
      if (changes.to?.nullable == true) {
        subqueries.push(`DROP NOT NULL`);
      }
      else if (changes.to?.nullable == false) {
        subqueries.push(`SET NOT NULL`);
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