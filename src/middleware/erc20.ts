import { Interface } from "@ethersproject/abi"
import { DateTime } from "luxon"
import { Middleware, RoastedResult } from "."
import { Transaction } from "../beancount"
import { Erc20Transfer, InternalTx, NormalTx } from "../service/etherscan_model"
import { getShortAddress, getTokenInfo, TxCombined } from "../util/ethereum"
import { TokenInfo } from "../util/transform"
import { ERC20_ABI } from "./erc20_abi"

export class Erc20Middleware implements Middleware {
  tokenInfoMap: Record<string, TokenInfo> = {}

  async roastTransaction(combinedTx: TxCombined, beanTx: Transaction): Promise<void> {
    if (combinedTx.normalTx && combinedTx.normalTx.input.startsWith("0x095ea7b3")) {
      const tx = combinedTx.normalTx
      const erc20Interface = new Interface(ERC20_ABI)
      const description = erc20Interface.parseTransaction({ data: tx.input, value: tx.value })
      const tokenInfo = this.tokenInfoMap[tx.to] || (await getTokenInfo(tx.to))
      this.tokenInfoMap[tx.to] = tokenInfo
      beanTx.narration = `${description.name} ${tokenInfo.symbol} for ${getShortAddress(
        description.args.guy
      )}`
    }
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
    return Promise.resolve()
  }
}
