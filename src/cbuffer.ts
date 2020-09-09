import { insertSorted, findNearest } from './utilities';

/**
 * In-memory sorted cache of objects.
 */
export class CBuffer {
  private compare: CallableFunction;
  private unique: boolean;
  private buffer = [];

  constructor(compare: CallableFunction, unique: boolean) {
    this.compare = compare;
    this.unique = unique;
  }

  /**
   * Get an element at the given position.
   * @param at - Position to fetch from.
   */
  getAt(at: number): any {
    return this.buffer[at];
  }

  /**
   * Convenience method for getting the last element of the buffer.
   */
  getLast(): any {
    return this.buffer.length > 0 ? this.buffer[this.buffer.length - 1] : undefined;
  }

  /**
   * Add new element(s) to the buffer. Variadic: takes one or more arguments. If an array is passed as a single
   * argument, its elements are inserted individually.
   */
  put(...values: any[]) {
    let insert = null;
    if (values.length === 1) {
      insert = values[0];
    } else {
      insert = values;
    }
    for (const key in insert) {
      if (Object.prototype.hasOwnProperty.call(insert, key)) {
        insertSorted(insert[key], this.buffer, this.unique, this.compare);
      }
    }
  }

  /**
   * Remove element at the given position.
   * @param at - Position to delete at.
   */
  delAt(at: number) {
    const r = this.buffer.splice(at, 1);
    if (r && r.length > 0) {
      return r[0];
    }
    return undefined;
  }

  /**
   * Remove elements between two positions.
   * @param before - Position to delete to (exclusive).
   * @param since - Position to delete from (inclusive).
   */
  delRange(since: number, before: number) {
    return this.buffer.splice(since, before - since);
  }

  /**
   * Return the number of elements the buffer holds.
   */
  length(): number {
    return this.buffer.length;
  }

  /**
   * Reset the buffer discarding all elements
   */
  reset() {
    this.buffer = [];
  }

  /**
   * Apply given function `callback` to all elements of the buffer.
   * @param callback - Function to call for each element.
   * @param startIdx - Optional index to start iterating from (inclusive).
   * @param beforeIdx - Optional index to stop iterating before (exclusive).
   * @param context - calling context (i.e. value of 'this' in callback)
   */
  forEach(callback: CallableFunction, startIdx?: number, beforeIdx?: number, context?: any): void {
    startIdx = startIdx | 0;
    beforeIdx = beforeIdx || this.buffer.length;
    for (let i = startIdx; i < beforeIdx; i++) {
      callback(context, this.buffer[i], i);
    }
  }

  /**
   * Find element in buffer using buffer's comparison function.
   * @param elem - element to find.
   * @param nearest - when true and exact match is not found, return the nearest element (insertion point).
   */
  find(elem: any, nearest?: boolean): number {
    const {
      idx
    } = findNearest(elem, this.buffer, !nearest);
    return idx;
  }
}
