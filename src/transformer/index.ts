import Big from "big.js"
import { DateTime } from "luxon"
import {
  Balance,
  BookingMethod,
  Cost,
  Directive,
  Open,
  Posting,
  TokenSymbol,
  Transaction,
} from "../beancount"
import { OperatingCurrency } from "../beancount/operating_currency"
import { Price } from "../beancount/price"
import { Account, Config } from "../config"
import { Middleware } from "../middleware"
import { TxFeeMiddleware } from "../middleware/txfee"
import { CoinGecko, ETHEREUM_COIN_ID } from "../service/coingecko"
import { Etherscan } from "../service/etherscan"
import { BaseTx, Erc20Transfer, NormalTx } from "../service/etherscan_model"
import { ETH_SYMBOL, TxCombined } from "../util/ethereum"
import { parseBigNumber } from "../util/misc"
import {
  AccountType,
  getAccountName,
  getBlockNumber,
  getTransferPostings,
  isExchange,
  TokenInfo,
} from "../util/transform"

Big.NE = -8

export class Transformer {
  readonly coingecko: CoinGecko
  readonly config: Config
  middleware: Middleware[]

  constructor(coingecko: CoinGecko, config: Config) {
    this.coingecko = coingecko
    this.config = config

    this.middleware = [new TxFeeMiddleware(coingecko, config)]
  }

  initBeans(date: DateTime): Directive[] {
    const directives: Directive[] = []

    this.middleware.forEach((middleware) => {
      middleware.init(date, directives)
    })

    directives.push(
      new OperatingCurrency(this.config.baseCurrency),
      ...this.config.accounts.map(
        (account) => new Open({ date, account: account.name, bookingMethod: BookingMethod.FIFO })
      ),
      new Open({ date, account: this.config.defaultExpense }),
      new Open({ date, account: this.config.defaultIncome }),
      new Open({ date, account: this.config.pnlAccount })
    )

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

    const exchange = isExchange(combinedTx, this.config)
    const ethCostPrice = await this.coingecko.getHistoryPriceByCurrency(
      ETHEREUM_COIN_ID,
      DateTime.fromSeconds(combinedTx.timeStamp),
      this.config.baseCurrency
    )
    const ethCost = new Cost({
      symbol: new TokenSymbol(this.config.baseCurrency),
      amount: ethCostPrice,
    })

    // normal transaction
    if (combinedTx.normalTx) {
      const postings = await this.getNormalTxPostings(combinedTx.normalTx, ethCost)
      beanTx.postings.push(...postings)
    }

    // internal transactions
    const internalTxPostings = await Promise.all(
      combinedTx.internalTxs.map((internalTx) =>
        this.getEtherTransferPostings(internalTx, parseBigNumber(internalTx.value), ethCost)
      )
    )
    beanTx.postings.push(...internalTxPostings.flat())

    // erc20 transfers
    const erc20TransferPostings = await Promise.all(
      combinedTx.erc20Transfers.map((erc20Transfer) => this.getErc20TransferPostings(erc20Transfer))
    )
    beanTx.postings.push(...erc20TransferPostings.flat())

    // add pnl account for balancing
    beanTx.postings.push(new Posting({ account: this.config.pnlAccount }))

    // if the transaction is for token exchange, remove default income & expense
    // to keep cost is align
    if (exchange) {
      const filtered = beanTx.postings.filter(
        (posting) =>
          posting.account !== this.config.defaultExpense &&
          posting.account !== this.config.defaultIncome
      )
      beanTx.postings = filtered
    }

    return beanTx
  }

  async getBalances(
    account: Account,
    tokenInfos: TokenInfo[],
    etherscan: Etherscan
  ): Promise<Balance[]> {
    const balances: Balance[] = []
    const ethBalanceAmount = await etherscan.getEthBalance(account.address)
    balances.push(
      new Balance({
        account: account.name,
        amount: parseBigNumber(ethBalanceAmount),
        symbol: ETH_SYMBOL,
      })
    )
    for (let i = 0; i < tokenInfos.length; i++) {
      const tokenInfo = tokenInfos[i]
      console.log(`getting balance for ${tokenInfo.symbol} (${tokenInfo.address})`)
      const result = await etherscan.getErc20Balance(account.address, tokenInfo.address)
      balances.push(
        new Balance({
          account: account.name,
          amount: parseBigNumber(result, tokenInfo.decimal),
          symbol: tokenInfo.symbol,
        })
      )
    }

    return balances
  }

  async getPrices(tokenInfos: TokenInfo[]): Promise<Price[]> {
    const prices: Price[] = []
    const baseCurrency = this.config.baseCurrency.toLowerCase()

    const ethInfo = await this.coingecko.getCoinInfoById(ETHEREUM_COIN_ID)
    prices.push(
      new Price({
        date: DateTime.local(),
        holding: ETH_SYMBOL,
        amount: new Big(ethInfo.market_data.current_price[baseCurrency]),
        symbol: new TokenSymbol(baseCurrency),
      })
    )

    for (let i = 0; i < tokenInfos.length; i++) {
      const tokenInfo = tokenInfos[i]
      console.log(`getting price for ${tokenInfo.symbol} (${tokenInfo.address})`)

      try {
        const result = await this.coingecko.getCoinInfoByContractAddress(tokenInfo.address)
        prices.push(
          new Price({
            date: DateTime.local(),
            holding: tokenInfo.symbol,
            amount: new Big(result.market_data.current_price[baseCurrency]),
            symbol: new TokenSymbol(baseCurrency),
          })
        )
      } catch (e) {
        //do nothing
      }
    }

    return prices
  }

  async getNormalTxPostings(normalTx: NormalTx, cost: Cost): Promise<Posting[]> {
    const postings: Posting[] = []
    const value = parseBigNumber(normalTx.value)

    // if value > 0 get postings for ETH transfer
    if (value.gt(0)) {
      postings.push(...this.getEtherTransferPostings(normalTx, value, cost))
    }

    return postings
  }

  async getErc20TransferPostings(transfer: Erc20Transfer): Promise<Posting[]> {
    const from = getAccountName(transfer.from, AccountType.From, this.config)
    const to = getAccountName(transfer.to, AccountType.To, this.config)
    const amount = parseBigNumber(transfer.value, Number.parseInt(transfer.tokenDecimal))
    const symbol = new TokenSymbol(transfer.tokenSymbol)
    const date = DateTime.fromSeconds(Number.parseInt(transfer.timeStamp))
    let costPrice = new Big(0)

    try {
      const coinInfo = await this.coingecko.getCoinInfoByContractAddress(transfer.contractAddress)
      costPrice = await this.coingecko.getHistoryPriceByCurrency(
        coinInfo.id,
        date,
        this.config.baseCurrency
      )
    } catch (e) {
      // keep costPrice 0
    }

    const cost = new Cost({ amount: costPrice, symbol: new TokenSymbol(this.config.baseCurrency) })

    if (amount.gt(0)) {
      return getTransferPostings(from, to, amount, symbol, cost)
    } else {
      return []
    }
  }

  getEtherTransferPostings(tx: BaseTx, amount: Big, cost: Cost, symbol = ETH_SYMBOL): Posting[] {
    const from = getAccountName(tx.from, AccountType.From, this.config)
    const to = getAccountName(tx.to, AccountType.To, this.config)
    return getTransferPostings(from, to, amount, symbol, cost)
  }
}
