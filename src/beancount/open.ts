import { DateTime } from "luxon"
import "reflect-metadata"
import { copyValues } from "../util/object"
import { Directive, DEFAULT_SYMBOL, DEFAULT_ACCOUNT, DEFAULT_DATE } from "./directive"

export class Open extends Directive {
  readonly type: string = "open"

  date: DateTime = DEFAULT_DATE
  symbol: string = DEFAULT_SYMBOL
  account: string = DEFAULT_ACCOUNT

  constructor(open?: Partial<Open>) {
    super()
    if (open) {
      copyValues(open, this)
    }
  }

  toString() {
    const { date, account, symbol } = this
    return `${date.toISODate()} open ${account} ${symbol}`
  }
}
