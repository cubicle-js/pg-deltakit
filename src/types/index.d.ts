export type TypeDefinition = string;
export type ColumnDefinition = {
  type: TypeDefinition;
  primary?: boolean;
  length?: number|null;
  unique?: boolean;
  references?: string;
  nullable?: boolean;
  default?: any;
};
export type TableDefinition = { [key: string]: ColumnDefinition | TypeDefinition; };
export type SchemaDefinition = { [key: string]: TableDefinition; };


export type Changes = {
  from?: Partial<ColumnDefinition>,
  to?: Partial<ColumnDefinition>,
};

export type Operation = {
  target: 'tables' | 'columns' | 'constraints'
  type: 'create' | 'drop' | 'alter'
  name: string,
  changes?: Changes
};