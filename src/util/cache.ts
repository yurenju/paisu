import { readFileSync, statSync } from "fs"
import { access, readFile, stat, writeFile } from "fs/promises"

export type Store = Record<string, string>

export class Cache {
  readonly filename: string
  readonly store: Store

  constructor(filename: string, store: Store) {
    this.filename = filename
    this.store = store
  }

  put(key: string, value: string) {
    this.store[key] = value
    return writeFile(this.filename, JSON.stringify(this.store), { encoding: "utf-8" })
  }

  get(key: string): string {
    return this.store[key]
  }

  static load(filename: string) {
    let store = {}

    try {
      const text = readFileSync(filename, { encoding: "utf-8" })
      store = JSON.parse(text)
    } catch (e) {}

    return new Cache(filename, store)
  }
}
