import { DateTime } from "luxon"
import fetch from "node-fetch"
import { Middleware, RoastedResult } from "."
import { TokenSymbol, Transaction } from "../beancount"
import { Config } from "../config"
import { Erc20Transfer, InternalTx, NormalTx } from "../service/etherscan_model"
import { TxCombined } from "../util/ethereum"
import { parseBigNumber } from "../util/misc"
import { compareAddress, findAccount } from "../util/transform"
import { CToken, CTokenResponse } from "./compound_model"

const COMPOUND_BASE_URL = "https://api.compound.finance/api/v2"

export class CompoundMiddleware implements Middleware {
  config: Config
  cTokens: CToken[] = []

  constructor(config: Config) {
    this.config = config
  }

  async roastTransaction(combinedTx: TxCombined, beanTx: Transaction): Promise<void> {
    if (this.cTokens.length === 0) {
      const response = (await fetch(`${COMPOUND_BASE_URL}/ctoken`).then((res) =>
        res.json()
      )) as CTokenResponse
      this.cTokens = response.cToken
    }

    if (combinedTx.normalTx) {
      const tx = combinedTx.normalTx
      const cToken = this.cTokens.find((cToken) => compareAddress(cToken.token_address, tx.to))

      if (cToken) {
        if (tx.input.startsWith("0xa0712d68")) {
          const transfer = combinedTx.erc20Transfers
            .filter((transfer) => findAccount(this.config.accounts, transfer.from))
            .pop()
          if (transfer) {
            const amount = parseBigNumber(transfer.value, Number.parseInt(transfer.tokenDecimal))
            beanTx.narration = `Deposit ${amount} ${new TokenSymbol(
              transfer.tokenSymbol
            )} to compound`
          }
        }

        if (tx.input.startsWith("0xdb006a75")) {
          const transfer = combinedTx.erc20Transfers
            .filter((transfer) => findAccount(this.config.accounts, transfer.to))
            .pop()

          if (transfer) {
            const amount = parseBigNumber(transfer.value, Number.parseInt(transfer.tokenDecimal))
            beanTx.narration = `Redeem ${amount} ${new TokenSymbol(
              transfer.tokenSymbol
            )} from compound`
          }
        }
      }
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
