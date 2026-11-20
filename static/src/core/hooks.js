/**
 * MaterialBlue Hook System
 * WordPress / VSCode 風のアクション・フィルターフックを提供する軽量モジュール。
 */

export class HookRegistry {
  constructor() {
    this._listeners = new Map();
  }

  on(hookName, fn, options = {}) {
    if (typeof hookName !== 'string' || !hookName) {
      throw new TypeError('hookName must be a non-empty string');
    }
    if (typeof fn !== 'function') {
      throw new TypeError('Hook listener must be a function');
    }
    const priority = Number.isFinite(options.priority) ? options.priority : 10;
    const once = Boolean(options.once);
    if (!this._listeners.has(hookName)) {
      this._listeners.set(hookName, []);
    }
    const entry = { fn, priority, once };
    const list = this._listeners.get(hookName);
    list.push(entry);
    list.sort((a, b) => a.priority - b.priority);
    return () => this.off(hookName, fn);
  }

  once(hookName, fn, options = {}) {
    return this.on(hookName, fn, { ...options, once: true });
  }

  off(hookName, fn) {
    const list = this._listeners.get(hookName);
    if (!list) return;
    const next = list.filter((entry) => entry.fn !== fn);
    if (next.length === 0) {
      this._listeners.delete(hookName);
    } else {
      this._listeners.set(hookName, next);
    }
  }

  call(hookName, ...args) {
    const list = this._listeners.get(hookName);
    if (!list || list.length === 0) return;
    const snapshot = [...list];
    for (const entry of snapshot) {
      if (entry.once) {
        this.off(hookName, entry.fn);
      }
      try {
        entry.fn(...args);
      } catch (err) {
        console.error(`[MaterialBlue hooks] Error in "${hookName}":`, err);
      }
    }
  }

  applyFilters(hookName, initialValue, ...args) {
    const list = this._listeners.get(hookName);
    if (!list || list.length === 0) return initialValue;
    let current = initialValue;
    const snapshot = [...list];
    for (const entry of snapshot) {
      if (entry.once) {
        this.off(hookName, entry.fn);
      }
      try {
        const result = entry.fn(current, ...args);
        if (result !== undefined) {
          current = result;
        }
      } catch (err) {
        console.error(`[MaterialBlue hooks] Filter error in "${hookName}":`, err);
      }
    }
    return current;
  }

  registeredHooks() {
    return Array.from(this._listeners.keys());
  }
}

export const hooks = new HookRegistry();
