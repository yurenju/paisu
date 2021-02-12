import Big from "big.js"
import { DateTime } from "luxon"

export const DEFAULT_ACCOUNT = "Asset:Unknown"
export const DEFAULT_SYMBOL = "USD"
export const DEFAULT_AMOUNT = new Big(0)
export const DEFAULT_DATE = DateTime.local()
export const DEFAULT_HOLDING = "HOOL"

export abstract class Directive {
  [key: string]: any

  abstract toString(): string
}
