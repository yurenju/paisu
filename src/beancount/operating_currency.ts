import { Directive } from "./directive"

export class OperatingCurrency extends Directive {
  readonly currency: string

  constructor(currency: string) {
    super()
    this.currency = currency
  }

  toString() {
    return `option "operating_currency" "${this.currency}"`
  }
}
