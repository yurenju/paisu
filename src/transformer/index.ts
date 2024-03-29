import Big from "big.js"
import { DateTime } from "luxon"
import { Transaction } from "../beancount"
import { Config } from "../config"
import { Middleware, RoastedResult } from "../middleware"
import { CompoundMiddleware } from "../middleware/compound"
import { Erc20Middleware } from "../middleware/erc20"
import { RegularMiddleware } from "../middleware/regular"
import { SynthetixMiddle } from "../middleware/snx"
import { TxFeeMiddleware } from "../middleware/txfee"
import { UniswapMiddleware } from "../middleware/uniswap"
import { WethMiddleware } from "../middleware/weth"
import { CoinGecko } from "../service/coingecko"
import { Etherscan } from "../service/etherscan"
import { Erc20Transfer, InternalTx, NormalTx } from "../service/etherscan_model"
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
      new Erc20Middleware(),
      new CompoundMiddleware(config),
      new UniswapMiddleware(coingecko, config),
      // 1Inch does not work now
      // new OneInchMiddleware(coingecko, config),
      new SynthetixMiddle(),
      new WethMiddleware(coingecko, config),
      new RegularMiddleware(coingecko, etherscan, config),
    ]
  }

  async roastTransactions(combinedTxs: TxCombined[]): Promise<Transaction[]> {
    const beans: Transaction[] = []
    for (let i = 0; i < combinedTxs.length; i++) {
      const combinedTx = combinedTxs[i]
      const { hash } = combinedTx
      const blockNumber = getBlockNumber(combinedTx)
      const metadata = { hash, blockNumber }
      const date = DateTime.fromSeconds(combinedTx.timeStamp)
      const beanTx = new Transaction({ date, metadata })
      console.log(`roasting ${i + 1}/${combinedTxs.length} tx ${hash}`)
      for (let j = 0; j < this.middleware.length; j++) {
        const middleware = this.middleware[j]
        await middleware.roastTransaction(combinedTx, beanTx)
      }
      beans.push(beanTx)
    }

    return beans
  }

  async roastBeans(
    date: DateTime,
    combinedTxs: TxCombined[],
    normalTxs: NormalTx[],
    internalTxs: InternalTx[],
    erc20Transfers: Erc20Transfer[]
  ): Promise<RoastedResult> {
    const result: RoastedResult = {
      options: [],
      opens: [],
      transactions: [],
      balances: [],
      prices: [],
    }

    const txs = await this.roastTransactions(combinedTxs)
    result.transactions = txs

    for (let i = 0; i < this.middleware.length; i++) {
      const middleware = this.middleware[i]
      const middlewareName = middleware.constructor.name
      console.log(`roasting rest of bean for ${middlewareName} middleware`)
      await middleware.roastRestBeans(
        date,
        combinedTxs,
        normalTxs,
        internalTxs,
        erc20Transfers,
        result
      )
    }

    return result
  }
}
