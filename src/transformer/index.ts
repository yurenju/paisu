import Big from "big.js"
import { DateTime } from "luxon"
import { Directive, Transaction } from "../beancount"
import { Config } from "../config"
import { Middleware } from "../middleware"
import { RegularMiddleware } from "../middleware/regular"
import { TxFeeMiddleware } from "../middleware/txfee"
import { CoinGecko } from "../service/coingecko"
import { Etherscan } from "../service/etherscan"
import { Erc20Transfer } from "../service/etherscan_model"
import { TxCombined } from "../util/ethereum"
import { getBlockNumber } from "../util/transform"

Big.NE = -8

export class Transformer {
  readonly coingecko: CoinGecko
  readonly etherscan: Etherscan
  readonly config: Config
  middleware: Middleware[]

  constructor(coingecko: CoinGecko, etherscan: Etherscan, config: Config) {
    this.coingecko = coingecko
    this.etherscan = etherscan
    this.config = config

    this.middleware = [
      new TxFeeMiddleware(coingecko, config),
      new RegularMiddleware(coingecko, etherscan, config),
    ]
  }

  initBeans(date: DateTime): Directive[] {
    const directives: Directive[] = []

    this.middleware.forEach((middleware) => {
      middleware.init(date, directives)
    })

    return directives
  }

  async getTransaction(combinedTx: TxCombined): Promise<Transaction> {
    const { hash } = combinedTx
    const blockNumber = getBlockNumber(combinedTx)
    const metadata = { hash, blockNumber }
    const date = DateTime.fromSeconds(combinedTx.timeStamp)
    const beanTx = new Transaction({ date, metadata })

    for (let i = 0; i < this.middleware.length; i++) {
      const middleware = this.middleware[i]
      await middleware.processTransaction(combinedTx, beanTx)
    }

    return beanTx
  }

  async getCurrentStatus(erc20Transfers: Erc20Transfer[]) {
    const directives: Directive[] = []
    for (let i = 0; i < this.middleware.length; i++) {
      const middleware = this.middleware[i]
      await middleware.processCurrentStatus(erc20Transfers, directives)
    }

    return directives
  }
}
