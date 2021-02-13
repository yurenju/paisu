import Big from "big.js"
import { DateTime } from "luxon"
import { copyValues } from "../util/misc"
import {
  DEFAULT_AMOUNT,
  DEFAULT_DATE,
  DEFAULT_HOLDING,
  DEFAULT_SYMBOL,
  Directive,
} from "./directive"

export class Price extends Directive {
  date: DateTime = DEFAULT_DATE
  holding: string = DEFAULT_HOLDING
  amount: Big = DEFAULT_AMOUNT
  symbol: string = DEFAULT_SYMBOL

  constructor(price?: Partial<Price>) {
    super()
    if (price) {
      copyValues(price, this)
    }
  }

  toString() {
    const { date, holding, amount, symbol } = this
    return `${date.toISODate()} price ${holding} ${amount} ${symbol}`
  }
}
