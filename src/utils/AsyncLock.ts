/**
 * AsyncLock - Simple async lock for atomic operations
 * 
 * Prevents race conditions by ensuring only one async operation
 * executes at a time within the critical section.
 */

export class AsyncLock {
  private locked = false;
  private waiters: Array<() => void> = [];

  /**
   * Acquire the lock and execute the provided function
   * @param fn Function to execute while holding the lock
   * @returns Promise that resolves to the function's return value
   */
  async acquire<T>(fn: () => T | Promise<T>): Promise<T> {
    // Wait for the lock to be available
    await this.lock();
    
    try {
      return await fn();
    } finally {
      this.unlock();
    }
  }

  /**
   * Acquire the lock (internal)
   */
  private lock(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return Promise.resolve();
    }

    return new Promise(resolve => {
      this.waiters.push(resolve);
    });
  }

  /**
   * Release the lock (internal)
   */
  private unlock(): void {
    if (this.waiters.length > 0) {
      const next = this.waiters.shift();
      if (next) {
        next();
      }
    } else {
      this.locked = false;
    }
  }
}
