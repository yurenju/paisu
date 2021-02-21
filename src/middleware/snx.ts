import { DateTime } from "luxon"
import { Middleware, RoastedResult } from "."
import { Transaction } from "../beancount"
import { Erc20Transfer, InternalTx, NormalTx } from "../service/etherscan_model"
import { TxCombined } from "../util/ethereum"
import { compareAddress } from "../util/transform"

export class SynthetixMiddle implements Middleware {
  roastTransaction(combinedTx: TxCombined, beanTx: Transaction): Promise<void> {
    return Promise.resolve()
  }

  roastRestBeans(
    date: DateTime,
    combinedTxs: TxCombined[],
    normalTxs: NormalTx[],
    internalTxs: InternalTx[],
    erc20Transfers: Erc20Transfer[],
    result: RoastedResult
  ): Promise<void> {
    const oldContractAddress = "0xC011A72400E58ecD99Ee497CF89E3775d4bd732F"
    const newTransfers = erc20Transfers.filter(
      (transfer) => !compareAddress(transfer.contractAddress, oldContractAddress)
    )
    erc20Transfers.splice(0, erc20Transfers.length)
    erc20Transfers.push(...newTransfers)

    return Promise.resolve()
  }
}
