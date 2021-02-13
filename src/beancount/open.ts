import { DateTime } from "luxon"
import { copyValues } from "../util/object"
import { Directive, DEFAULT_SYMBOL, DEFAULT_ACCOUNT, DEFAULT_DATE } from "./directive"

export enum BookingMethod {
  FIFO = "FIFO",
  LIFO = "LIFO",
}

export class Open extends Directive {
  date: DateTime = DEFAULT_DATE
  symbol: string = DEFAULT_SYMBOL
  account: string = DEFAULT_ACCOUNT
  bookingMethod?: BookingMethod

  constructor(open?: Partial<Open>) {
    super()
    if (open) {
      copyValues(open, this)
    }
  }

  toString() {
    const { date, account, symbol, bookingMethod } = this
    let str = `${date.toISODate()} open ${account} ${symbol}`
    if (bookingMethod) {
      str += ` "${bookingMethod}"`
    }

    return str
  }
}
