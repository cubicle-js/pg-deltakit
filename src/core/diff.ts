import { Schema } from './schema.ts';
import { Migration } from './migration.ts';
import { Utils } from './utils.ts';

import type { ColumnDefinition } from '../types/index.d.ts';

export class Diff {
  protected source: Schema;
  protected destination: Schema;
  protected migration: Migration;
  protected rollback: Migration;

  constructor(source: Schema, destination: Schema) {
    this.source = source;
    this.destination = destination;
  }

  getMigration(): Migration {
    if (! this.migration) {
      this.migration = Diff.compare(this.source, this.destination);
    }
    return this.migration;
  }

  getRollback(): Migration {
    if (! this.rollback) {
      this.rollback = Diff.compare(this.destination, this.source).reverse();
    }
    return this.rollback;
  }

  /**
   * Cycle through JSON schemas representing tables (source and destination), and generate diff object
   * return the diff object as a migration object
   * @returns Migration
   */
  static compare(source: Schema, destination: Schema) : Migration {

    const migration = new Migration();

    //////////////////////////

    const sourceTables = source.getTables();
    const destinationTables = destination.getTables();
    const tables = Utils.unique(Utils.combine(sourceTables, destinationTables)) as string[];

    /**
     * Cycle through tables and columns
     */
    tables.forEach(table => {

      const tableInSource = sourceTables.includes(table);
      const tableInDestination = destinationTables.includes(table);
      const sourceColumns = tableInSource ? source.getColumns(table) : [];
      const destinationColumns = tableInDestination ? destination.getColumns(table) : [];
      const columns = Utils.unique(Utils.combine(sourceColumns, destinationColumns)) as string[];

      // if table exists in source XOR destination, then add operation to migration
      if (tableInSource != tableInDestination) {
        migration.addOperation({
          target: 'tables',
          type: tableInSource ? 'drop' : 'create',
          name: table,  
        });
      }

      /**
       * Cycle through columns
       */
      columns.forEach(column => {

        const columnInSource = sourceColumns.includes(column);
        const columnInDestination = destinationColumns.includes(column);
        const sourceColumnDefition = columnInSource ? source.getColumnDefinition(table, column) : {} as ColumnDefinition;
        const destinationColumnDefition = columnInDestination ? destination.getColumnDefinition(table, column) : {} as ColumnDefinition;
        const changes = Diff.diffColumns(sourceColumnDefition, destinationColumnDefition);

        // if column exists in source XOR destination, add drop/create operation to migration
        if (columnInSource != columnInDestination) {
          migration.addOperation({
            target: tableInDestination ? 'columns' : 'constraints',
            type: columnInSource ? 'drop' : 'create',
            name: [table, column].join('.'),
            changes: { from: sourceColumnDefition, to: destinationColumnDefition }
          });
        }

        // otherwise, compare column definitions
        else if (Object.keys(changes.to).length) {
          migration.addOperation({
            target: 'columns',
            type: 'alter',
            name: [table, column].join('.'),
            changes: changes,
          });
        }

      }); // end columns

    }); // end tables

    //////////////////////////
    
    return migration;
  }

  static diffColumns(
    objA: ColumnDefinition,
    objB: ColumnDefinition,
  ): { from: Partial<ColumnDefinition>, to: Partial<ColumnDefinition> } {
    const from: Partial<ColumnDefinition> = {};
    const to: Partial<ColumnDefinition> = {};
  
    // Combine both keys from objA and objB
    const keys = Utils.unique(Utils.combine(Object.keys(objA), Object.keys(objB)));
  
    keys.forEach(key => {
      if (objA[key] !== objB[key]) {
        from[key] = objA[key];
        to[key] = objB[key];
      }
    });
  
    return { from, to };
  }

}