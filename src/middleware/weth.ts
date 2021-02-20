import { DateTime } from "luxon"
import { Middleware } from "."
import { Cost, Directive, Posting, TokenSymbol, Transaction } from "../beancount"
import { Config } from "../config"
import { CoinGecko, ETHEREUM_COIN_ID } from "../service/coingecko"
import { Erc20Transfer } from "../service/etherscan_model"
import { TxCombined } from "../util/ethereum"
import { parseBigNumber } from "../util/misc"
import { compareAddress, findAccount } from "../util/transform"

export class WethMiddleware implements Middleware {
  coingecko: CoinGecko
  config: Config
  contractAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"

  constructor(coingecko: CoinGecko, config: Config) {
    this.config = config
    this.coingecko = coingecko
  }

  init(date: DateTime, directives: Directive[]): void {}

  async processTransaction(combinedTx: TxCombined, beanTx: Transaction): Promise<void> {
    const wethSymbol = new TokenSymbol("WETH")
    const ethCostPrice = await this.coingecko.getHistoryPriceByCurrency(
      ETHEREUM_COIN_ID,
      DateTime.fromSeconds(combinedTx.timeStamp),
      this.config.baseCurrency
    )
    const ethCost = new Cost({
      symbol: new TokenSymbol(this.config.baseCurrency),
      amount: ethCostPrice,
    })

    if (!combinedTx.normalTx || !compareAddress(combinedTx.normalTx.to, this.contractAddress)) {
      return
    }

    for (let i = 0; i < combinedTx.internalTxs.length; i++) {
      const internalTx = combinedTx.internalTxs[i]

      const from = findAccount(this.config.accounts, internalTx.from)
      const to = findAccount(this.config.accounts, internalTx.to)
      let posting: Posting | undefined

      //wrap
      if (from) {
        posting = new Posting({
          account: from.name,
          amount: parseBigNumber(internalTx.value),
          symbol: wethSymbol,
          cost: ethCost,
        })
      }

      //unwrap
      if (to) {
        posting = new Posting({
          account: to.name,
          amount: parseBigNumber(internalTx.value).mul(-1),
          symbol: wethSymbol,
          cost: new Cost({ ambiguous: true }),
        })
      }

      if (posting) {
        beanTx.postings.push(posting)
      }
    }
  }

  processCurrentStatus(transfers: Erc20Transfer[], directives: Directive[]): Promise<void> {
    return Promise.resolve()
  }
}
