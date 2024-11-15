export const CONFIG = {
  /**
   * Credit to https://github.com/multum/pg-differ/blob/main/lib/types.js
   */
  normalisations: {
    type: {
      "int8": "bigint",
      "varbit": "bit varying",
      "bool": "boolean",
      "char": "character",
      "varchar": "character varying",
      "float8": "double precision",
      "int4": "integer",
      "int": "integer",
      "decimal": "numeric",
      "float4": "real",
      "int2": "smallint",
      "time": "time without time zone",
      "timetz": "time with time zone",
      "timestamp": "timestamp without time zone",
      "timestamptz": "timestamp with time zone",
    }
  }
}