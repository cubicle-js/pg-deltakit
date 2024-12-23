import type { SchemaDefinition, TableDefinition, ColumnDefinition, Client } from "../types/index.d.ts";
import { CONFIG } from "../config.ts";

export class Schema {
  protected definition: SchemaDefinition;

  private static readonly COLUMN_QUERY = `
    SELECT 
      table_name AS table, column_name AS column, 
      data_type AS type, character_maximum_length AS length, 
      is_nullable = 'YES' AS nullable, column_default AS default_info 
    FROM information_schema.columns 
    WHERE table_schema = $1;
  `;

  private static readonly CONSTRAINT_QUERY = `
    SELECT 
      tc.table_name AS table, ccu.column_name AS column, 
      tc.constraint_name AS constraint_name, tc.constraint_type AS constraint_type, 
      ccu.table_name AS references, kcu.column_name AS fk_column 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.constraint_column_usage AS ccu 
      ON tc.constraint_name = ccu.constraint_name 
    JOIN information_schema.key_column_usage AS kcu 
      ON tc.constraint_name = kcu.constraint_name 
      AND tc.table_schema = kcu.table_schema 
    WHERE tc.table_schema = $1;
  `;

  constructor(definition: SchemaDefinition) {
    this.definition = definition;
  }

  public getTables(): string[] {
    return Object.keys(this.definition);
  }

  public getColumns(table: string): string[] {
    return Object.keys(this.definition[table]);
  }

  public getColumnDefinition(table: string, column: string): ColumnDefinition {
 
    /**
     * Expand short-hand notation to full
     * e.g. 'id: varchar' => { type: 'varchar' }
     */
    if (typeof this.definition[table][column] === 'string') {
      this.definition[table][column] = { type: this.definition[table][column] };
    }

    /**
     * Provide defaults for missing fields
     */
    this.definition[table][column] = {
      primary: false,
      length: null,
      unique: false,
      nullable: true,
      default: null,
      ...this.definition[table][column],
    };

    // Primary enforces nullable to false
    if (this.definition[table][column].primary) {

      if (this.definition[table][column].nullable == true) {
        console.warn(`Column ${table}.${column} is primary key, setting nullable to false`);
        this.definition[table][column].nullable = false;
      }
      
    }

    /**
     * Normalize
     * 
     * For each key (eg type, length, nullable, etc) check if the value is in the mappings
     * If so, replace it with the mapped value
     * e.g. type: 'varchar' => 'character varying'
     * 
     * @todo: Add more normalisations, see https://github.com/multum/pg-differ/blob/main/lib/types.js
     */
    Object.keys(CONFIG.normalisations).map((field) => {
      const mappings = CONFIG.normalisations[field];
      const froms = Object.keys(mappings);
      if (froms.includes(this.definition[table][column][field])) {
        this.definition[table][column][field] = mappings[this.definition[table][column][field]];
      }
    });

    return this.definition[table][column];
  }

  public static async fromDatabase(client : Client, schema:string='public'): Promise<Schema> {
    // await client.connect();

    let definition: Partial<SchemaDefinition> = {};

    const queryColumns = await client.query(this.COLUMN_QUERY, [schema]);
    
    queryColumns.rows.map((row: any) => { 
      const { table, column, type, length, nullable, default_info } = row;

      /**
       * Parse default value meta-data and normalise
       */
      const default_value = (default_info === null || default_info.substring(0, 6) == 'NULL::')
        ? null 
        : default_info.split('::').shift();

      /**
       * Debugging
       */
      // console.log(table, column, type, length, nullable, default_value, default_info);

      if (typeof definition[table] === 'undefined') {
        definition[table] = {} as TableDefinition;
      }

      if (typeof definition[table][column] === 'undefined') {
        definition[table][column] = {
          type: type,
          length: length,
          nullable: nullable,
          default: default_value
        } as ColumnDefinition;
      }
    });

    const queryConstraints = await client.query(this.CONSTRAINT_QUERY, [schema]);
    queryConstraints.rows.map((row: any) => { 
      const { table, column, constraint_name, constraint_type, references, fk_column } = row;

      /**
       * Debugging
       */
      // console.log(table, column, constraint_name, constraint_type, references, fk_column);

      if (!definition[table] || !definition[table][column] ) {
        return;
      }

      switch(constraint_type) {
        case 'PRIMARY KEY':
          (definition[table][column] as ColumnDefinition).primary = true;
          break;
        case 'UNIQUE':
          (definition[table][column] as ColumnDefinition).unique = true;
          break;
        case 'FOREIGN KEY':
          (definition[table][fk_column] as ColumnDefinition).references = references;
          break;
      }
    });

    // console.log('DEF FROM DB', definition);
    // await client.end();
    return new Schema(definition as SchemaDefinition);
  }
}