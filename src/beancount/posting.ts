import Big from "big.js"
import { copyValues } from "../util/misc"
import { DEFAULT_SYMBOL, DEFAULT_ACCOUNT, DEFAULT_AMOUNT } from "./directive"

export enum PriceType {
  Unit = "unit",
  Total = "total",
}

export class Cost {
  amount: Big = DEFAULT_AMOUNT
  symbol: string = DEFAULT_SYMBOL

  constructor(cost: Partial<Cost>) {
    if (cost) {
      copyValues(cost, this)
    }
  }
}

export class PostingPrice {
  type: PriceType = PriceType.Unit
  amount: Big = DEFAULT_AMOUNT
  symbol: string = DEFAULT_SYMBOL
}

export class Posting {
  [key: string]: any

  account: string = DEFAULT_ACCOUNT
  amount: Big = DEFAULT_AMOUNT
  symbol: string = DEFAULT_SYMBOL
  metadata: Record<string, string> = {}
  cost?: Cost
  price?: PostingPrice

  constructor(posting?: Partial<Posting>) {
    if (posting) {
      copyValues(posting, this)
    }
  }

  toString() {
    const { account, amount, symbol, cost, price, metadata } = this
    const lines = []

    let major = `  ${account}`
    if (!amount.eq(0)) {
      major += ` ${amount} ${symbol}`

      if (cost) {
        if (cost.amount.eq(0)) {
          major += " {}"
        } else {
          major += ` {${cost.amount} ${cost.symbol}}`
        }
      }

      // add "@ 200 USD" or "@@ 200 USD" depends on type
      if (price) {
        const operator = price.type === PriceType.Unit ? "@" : "@@"
        major += ` ${operator} ${price.amount} ${price.symbol}`
      }
    }

    lines.push(major)

    if (Object.keys(metadata).length > 0) {
      lines.push(...Object.entries(metadata).map(([key, value]) => `    ${key}: "${value}"`))
    }

    return lines.join("\n")
  }
}
