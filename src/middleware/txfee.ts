import { DateTime } from "luxon"
import { Middleware, RoastedResult } from "."
import { Cost, Open, Posting, TokenSymbol, Transaction } from "../beancount"
import { Config } from "../config"
import { CoinGecko, ETHEREUM_COIN_ID } from "../service/coingecko"
import { Erc20Transfer, InternalTx, NormalTx } from "../service/etherscan_model"
import { ETH_SYMBOL, TxCombined } from "../util/ethereum"
import { parseBigNumber } from "../util/misc"
import { AccountType, findAccount, getAccountName, getTransferPostings } from "../util/transform"

export class TxFeeMiddleware implements Middleware {
  config: Config
  coingecko: CoinGecko

  constructor(coingecko: CoinGecko, config: Config) {
    this.coingecko = coingecko
    this.config = config
  }

  async roastRestBeans(
    date: DateTime,
    combinedTxs: TxCombined[],
    normalTxs: NormalTx[],
    internalTxs: InternalTx[],
    erc20Transfers: Erc20Transfer[],
    result: RoastedResult
  ): Promise<void> {
    result.opens.push(new Open({ date, account: this.config.txFeeAccount }))
  }

  async roastTransaction(combinedTx: TxCombined, beanTx: Transaction): Promise<void> {
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

  getTxFeePostings(normalTx: NormalTx, cost: Cost, symbol = ETH_SYMBOL): Posting[] {
    const from = getAccountName(normalTx.from, AccountType.From, this.config)
    const gasPrice = parseBigNumber(normalTx.gasPrice)
    const amount = gasPrice.mul(normalTx.gasUsed)
    return getTransferPostings(from, this.config.txFeeAccount, amount, symbol, cost)
  }
}
