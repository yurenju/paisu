import { Directive } from "./directive"

export class Option extends Directive {
  key: string
  value: string

  constructor(key: string, value: string) {
    super()
    this.key = key
    this.value = value
  }

  toString(): string {
    return `option "${this.key}" "${this.value}"`
  }
}
