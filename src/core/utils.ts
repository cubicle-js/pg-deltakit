import { ColumnDefinition } from './schema.ts';

export class Utils {
  static combine<T>(arrayA: T[], arrayB: T[]): T[] {
    return [...new Set([...arrayA, ...arrayB])];
  }

  static unique<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

  static combineUnique<T>(arrayA: T[], arrayB: T[]): T[] {
    return Utils.unique(Utils.combine(arrayA, arrayB));
  }

  static hasQuotes(value: any): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    return (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
  }

  static ensureQuotes(value: any): any {
    return Utils.hasQuotes(value) ? value : `"${Utils.escape(value)}"`;
  }

  static noQuotes(value: any): any {
    return Utils.hasQuotes(value) ? value.slice(1, -1) : value;
  }

  static escape(value: string): string {
    return value.replace(/"/g, '\\"');
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