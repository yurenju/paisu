import { DateTime } from "luxon"
import { copyValues } from "../util/misc"
import { Directive, DEFAULT_SYMBOL, DEFAULT_ACCOUNT, DEFAULT_DATE } from "./directive"

export enum BookingMethod {
  FIFO = "FIFO",
  LIFO = "LIFO",
}

export class Open extends Directive {
  date: DateTime = DEFAULT_DATE
  account: string = DEFAULT_ACCOUNT
  symbol?: string
  bookingMethod?: BookingMethod

  constructor(open?: Partial<Open>) {
    super()
    if (open) {
      copyValues(open, this)
    }
  }

  toString() {
    const { date, account, symbol, bookingMethod } = this
    let str = `${date.toISODate()} open ${account}`
    if (symbol) {
      str += ` ${symbol}`
    }
    if (bookingMethod) {
      str += ` "${bookingMethod}"`
    }

    return str
  }
}
