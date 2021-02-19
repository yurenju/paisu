import { DateTime } from "luxon"
import { Middleware } from "."
import { Directive, Transaction } from "../beancount"
import { Erc20Transfer } from "../service/etherscan_model"
import { TxCombined } from "../util/ethereum"
import { compareAddress } from "../util/transform"

export class SynthetixMiddle implements Middleware {
  init(date: DateTime, directives: Directive[]): void {}
  processTransaction(combinedTx: TxCombined, beanTx: Transaction): Promise<void> {
    return Promise.resolve()
  }
  processCurrentStatus(transfers: Erc20Transfer[], directives: Directive[]): Promise<void> {
    const oldContractAddress = "0xC011A72400E58ecD99Ee497CF89E3775d4bd732F"
    const newTransfers = transfers.filter(
      (transfer) => !compareAddress(transfer.contractAddress, oldContractAddress)
    )
    transfers.splice(0, transfers.length)
    transfers.push(...newTransfers)
    return Promise.resolve()
  }
}
