import Big from "big.js"
import { DateTime } from "luxon"
import { copyValues } from "../util/misc"
import {
  Directive,
  DEFAULT_ACCOUNT,
  DEFAULT_SYMBOL,
  DEFAULT_AMOUNT,
  DEFAULT_DATE,
} from "./directive"

export class Balance extends Directive {
  date: DateTime = DEFAULT_DATE
  account: string = DEFAULT_ACCOUNT
  amount: Big = DEFAULT_AMOUNT
  symbol: string = DEFAULT_SYMBOL

  constructor(balance?: Partial<Balance>) {
    super()
    if (balance) {
      copyValues(balance, this)
    }
  }

  toString(): string {
    const { date, account, amount, symbol } = this
    return `${date.toISODate()} balance ${account} ${amount} ${symbol}`
  }
}
