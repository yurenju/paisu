import { DateTime } from "luxon"
import { Directive, Transaction } from "../beancount"
import { Erc20Transfer } from "../service/etherscan_model"
import { TxCombined } from "../util/ethereum"

export interface Middleware {
  init(date: DateTime, directives: Directive[]): void
  processTransaction(combinedTx: TxCombined, beanTx: Transaction): Promise<void>
  processCurrentStatus(transfers: Erc20Transfer[], directives: Directive[]): Promise<void>
}
