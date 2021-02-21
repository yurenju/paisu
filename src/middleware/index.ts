import { DateTime } from "luxon"
import { Balance, Open, Transaction } from "../beancount"
import { Option } from "../beancount/option"
import { Price } from "../beancount/price"
import { Erc20Transfer, InternalTx, NormalTx } from "../service/etherscan_model"
import { TxCombined } from "../util/ethereum"

export interface RoastedResult {
  options: Option[]
  opens: Open[]
  transactions: Transaction[]
  balances: Balance[]
  prices: Price[]
}

export interface Middleware {
  roastTransaction(combinedTx: TxCombined, beanTx: Transaction): Promise<void>
  roastRestBeans(
    date: DateTime,
    combinedTxs: TxCombined[],
    normalTxs: NormalTx[],
    internalTxs: InternalTx[],
    erc20Transfers: Erc20Transfer[],
    result: RoastedResult
  ): Promise<void>
}
