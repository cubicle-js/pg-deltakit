export class Utils {
  static combineTwo<T>(arrayA: T[], arrayB: T[]): T[] {
    return [...new Set([...arrayA, ...arrayB])];
  }

  static combine<T>(...arrays: T[][]): T[] {
    return [...new Set(arrays.flat())];
  }

  static unique<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

  static combineUnique<T>(arrayA: T[], arrayB: T[]): T[] {
    return Utils.unique(Utils.combine(arrayA, arrayB));
  }

}