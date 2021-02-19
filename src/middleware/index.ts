import { DateTime } from "luxon"
import { Directive, Transaction } from "../beancount"
import { Price } from "../beancount/price"
import { TxCombined } from "../util/ethereum"
import { TokenInfo } from "../util/transform"

export interface Middleware {
  init(date: DateTime, directives: Directive[]): void
  processTransaction(combinedTx: TxCombined, beanTx: Transaction): Promise<void>
  processMarketPrices(tokenInfos: TokenInfo[], prices: Price[]): Promise<void>
}
