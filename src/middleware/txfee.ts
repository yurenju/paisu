import { DateTime } from "luxon"
import { Middleware } from "."
import { Cost, Directive, Open, Posting, TokenSymbol, Transaction } from "../beancount"
import { Price } from "../beancount/price"
import { Config } from "../config"
import { CoinGecko, ETHEREUM_COIN_ID } from "../service/coingecko"
import { NormalTx } from "../service/etherscan_model"
import { ETH_SYMBOL, TxCombined } from "../util/ethereum"
import { parseBigNumber } from "../util/misc"
import {
  AccountType,
  findAccount,
  getAccountName,
  getTransferPostings,
  TokenInfo,
} from "../util/transform"

export class TxFeeMiddleware implements Middleware {
  config: Config
  coingecko: CoinGecko

  constructor(coingecko: CoinGecko, config: Config) {
    this.coingecko = coingecko
    this.config = config
  }

  init(date: DateTime, directives: Directive[]): void {
    directives.push(new Open({ date, account: this.config.txFeeAccount }))
  }

  async processTransaction(combinedTx: TxCombined, beanTx: Transaction): Promise<void> {
    const ethCostPrice = await this.coingecko.getHistoryPriceByCurrency(
      ETHEREUM_COIN_ID,
      DateTime.fromSeconds(combinedTx.timeStamp),
      this.config.baseCurrency
    )
    const ethCost = new Cost({
      symbol: new TokenSymbol(this.config.baseCurrency),
      amount: ethCostPrice,
    })

    // if transaction is created from the account itself, get postings for tx fee
    if (combinedTx.normalTx && findAccount(this.config.accounts, combinedTx.normalTx.from)) {
      beanTx.postings.push(...this.getTxFeePostings(combinedTx.normalTx, ethCost))
    }
  }

  processMarketPrices(tokenInfos: TokenInfo[], prices: Price[]): Promise<void> {
    // no implementation
    return Promise.resolve()
  }

  getTxFeePostings(normalTx: NormalTx, cost: Cost, symbol = ETH_SYMBOL): Posting[] {
    const from = getAccountName(normalTx.from, AccountType.From, this.config)
    const gasPrice = parseBigNumber(normalTx.gasPrice)
    const amount = gasPrice.mul(normalTx.gasUsed)
    return getTransferPostings(from, this.config.txFeeAccount, amount, symbol, cost)
  }
}
