import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { Utils } from "./utils.ts";
import { SchemaDefinition, TableDefinition, ColumnDefinition } from "../types/index.d.ts";

export { Client };

const normalisations = {
  type: {
    "varchar": "character varying",
    "timestamp": "timestamp without time zone",
  }
};

export class Schema {
  protected definition: SchemaDefinition;

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

    /**
     * Normalize
     * 
     * For each key (eg type, length, nullable, etc) check if the value is in the mappings
     * If so, replace it with the mapped value
     * e.g. type: 'varchar' => 'character varying'
     * 
     * @todo: Add more normalisations, see https://github.com/multum/pg-differ/blob/main/lib/types.js
     */
    Object.keys(normalisations).map((field) => {
      const mappings = normalisations[field];
      const froms = Object.keys(mappings);
      if (froms.includes(this.definition[table][column][field])) {
        this.definition[table][column][field] = mappings[this.definition[table][column][field]];
      }
    });

    return this.definition[table][column];
  }

  public static async fromDatabase(client : Client, schema:string='public'): Promise<Schema> {
    await client.connect();

    let definition: Partial<SchemaDefinition> = {};

    const queryColumns = await client.queryArray("SELECT table_name, column_name, data_type, character_maximum_length AS length, is_nullable = 'YES' AS nullable, column_default AS default_info FROM information_schema.columns WHERE table_schema = '"+schema+"';");
    queryColumns.rows.map((row: any) => { 
      const [ table, column, type, length, nullable, default_info ] = row;
      const default_value = default_info === null || default_info.substring(0, 6) == 'NULL::' ? null : Utils.noQuotes(default_info.split('::').shift());
      // console.log(table, column, type, length, nullable, default_value);

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

    const queryConstraints = await client.queryArray("SELECT tc.table_name, ccu.column_name, tc.constraint_name, tc.constraint_type, ccu.table_name AS references, kcu.column_name AS fk_column FROM information_schema.table_constraints AS tc JOIN information_schema.constraint_column_usage AS ccu ON tc.constraint_name = ccu.constraint_name JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.table_schema = '"+schema+"';");
    queryConstraints.rows.map((row: any) => { 
      const [ table, column, constraint_name, constraint_type, references, fk_column ] = row;
      // console.log(table, column, constraint_name, constraint_type, references, fk_column);

      if (!definition[table] || !definition[table][column] ) {
        return;
      }

      switch(constraint_type) {
        case 'PRIMARY KEY':
          definition[table][column].primary = true;
          break;
        case 'UNIQUE':
          definition[table][column].unique = true;
          break;
        case 'FOREIGN KEY':
          definition[table][fk_column].references = references;
          break;
      }
    });

    // console.log('DEF FROM DB', definition);
    await client.end();
    return new Schema(definition as SchemaDefinition);
  }
}