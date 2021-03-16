import Big from "big.js"
import { DateTime, Duration } from "luxon"
import { Middleware, RoastedResult } from "."
import { Balance, BookingMethod, Cost, Open, Posting, TokenSymbol, Transaction } from "../beancount"
import { Option } from "../beancount/option"
import { Price } from "../beancount/price"
import { Account, Config } from "../config"
import { CoinGecko, ETHEREUM_COIN_ID } from "../service/coingecko"
import { Etherscan } from "../service/etherscan"
import { BaseTx, Erc20Transfer, InternalTx, NormalTx } from "../service/etherscan_model"
import { ETH_SYMBOL, TxCombined } from "../util/ethereum"
import { parseBigNumber } from "../util/misc"
import {
  AccountType,
  getAccountName,
  getTokenInfosByTransfers,
  getTransferNarration,
  getTransferPostings,
  isExchange,
  TokenInfo,
} from "../util/transform"

export class RegularMiddleware implements Middleware {
  config: Config
  coingecko: CoinGecko
  etherscan: Etherscan

  constructor(coingecko: CoinGecko, etherscan: Etherscan, config: Config) {
    this.coingecko = coingecko
    this.etherscan = etherscan
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
    this.init(date, result)
    await this.processBalancesAndPrices(erc20Transfers, result)
  }

  init(date: DateTime, result: RoastedResult): void {
    result.options.push(new Option("operating_currency", this.config.baseCurrency))
    result.opens.push(
      ...this.config.accounts.map(
        (account) => new Open({ date, account: account.name, bookingMethod: BookingMethod.FIFO })
      ),
      new Open({ date, account: this.config.defaultExpense }),
      new Open({ date, account: this.config.defaultIncome }),
      new Open({ date, account: this.config.pnlAccount })
    )
  }

  async roastTransaction(combinedTx: TxCombined, beanTx: Transaction): Promise<void> {
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

      if (combinedTx.normalTx.value !== "0" && combinedTx.erc20Transfers.length === 0) {
        const amount = parseBigNumber(combinedTx.normalTx.value)
        beanTx.narration = getTransferNarration(
          this.config.accounts,
          combinedTx.normalTx.from,
          amount,
          ETH_SYMBOL
        )
      }
    }

    // internal transactions
    const internalTxPostings = await Promise.all(
      combinedTx.internalTxs.map((internalTx) =>
        this.getEtherTransferPostings(internalTx, parseBigNumber(internalTx.value), ethCost)
      )
    )
    beanTx.postings.push(...internalTxPostings.flat())

    // erc20 transfers

    // fill narration if tx is a single erc20 transfer
    if (
      combinedTx.erc20Transfers.length === 1 &&
      (!combinedTx.normalTx || combinedTx.normalTx.value === "0")
    ) {
      const transfer = combinedTx.erc20Transfers[0]
      const amount = parseBigNumber(transfer.value, Number.parseInt(transfer.tokenDecimal))
      beanTx.narration = getTransferNarration(
        this.config.accounts,
        transfer.from,
        amount,
        new TokenSymbol(transfer.tokenSymbol)
      )
    }
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
  }

  async processBalancesAndPrices(
    erc20Transfers: Erc20Transfer[],
    result: RoastedResult
  ): Promise<void> {
    const tokenInfos = getTokenInfosByTransfers(erc20Transfers)

    for (let i = 0; i < this.config.accounts.length; i++) {
      const account = this.config.accounts[i]
      const balances = await this.getBalances(account, tokenInfos)
      result.balances.push(...balances)
    }

    result.prices.push(...(await this.getPrices(tokenInfos)))
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
      costPrice = await this.coingecko.getHistoryPriceByContractAddress(
        transfer.contractAddress,
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

  async getBalances(account: Account, tokenInfos: TokenInfo[]): Promise<Balance[]> {
    const tomorrow = DateTime.local().plus(Duration.fromObject({ day: 1 }))
    const balances: Balance[] = []
    const ethBalanceAmount = await this.etherscan.getEthBalance(account.address)
    balances.push(
      new Balance({
        date: tomorrow,
        account: account.name,
        amount: parseBigNumber(ethBalanceAmount),
        symbol: ETH_SYMBOL,
      })
    )
    for (let i = 0; i < tokenInfos.length; i++) {
      const tokenInfo = tokenInfos[i]
      console.log(`getting balance for ${tokenInfo.symbol} (${tokenInfo.address})`)
      const result = await this.etherscan.getErc20Balance(account.address, tokenInfo.address)
      balances.push(
        new Balance({
          date: tomorrow,
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
    const today = DateTime.local()

    const ethMarketData = await this.coingecko.getHistoricalMarketData(
      ETHEREUM_COIN_ID,
      baseCurrency
    )
    ethMarketData.prices.forEach(([timestamp, price]) => {
      prices.push(
        new Price({
          date: DateTime.fromMillis(timestamp),
          holding: ETH_SYMBOL,
          amount: new Big(price),
          symbol: new TokenSymbol(baseCurrency),
        })
      )
    })

    for (let i = 0; i < tokenInfos.length; i++) {
      const tokenInfo = tokenInfos[i]
      console.log(`getting price for ${tokenInfo.symbol} (${tokenInfo.address})`)

      try {
        const result = await this.coingecko.getHistoricalMarketDataByContractAddress(
          tokenInfo.address,
          baseCurrency
        )
        result.prices.forEach(([timestamp, price]) => {
          prices.push(
            new Price({
              date: DateTime.fromMillis(timestamp),
              holding: tokenInfo.symbol,
              amount: new Big(price),
              symbol: new TokenSymbol(baseCurrency),
            })
          )
        })
      } catch (e) {
        //do nothing
      }
    }

    return prices
  }
}
