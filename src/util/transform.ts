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
import { Account, Config } from "../config"
import { CoinGecko, ETHEREUM_COIN_ID } from "../service/coingecko"
import { Etherscan } from "../service/etherscan"
import { BaseTx, Erc20Transfer, NormalTx } from "../service/etherscan_model"
import { ETH_SYMBOL, TxCombined } from "./ethereum"
import { parseBigNumber } from "./misc"

enum AccountType {
  From = "from",
  To = "to",
}

export class Transformer {
  readonly coingecko: CoinGecko
  readonly config: Config

  constructor(coingecko: CoinGecko, config: Config) {
    this.coingecko = coingecko
    this.config = config
  }

  initBeans(date: DateTime): Directive[] {
    const directives: Directive[] = []
    directives.push(
      new OperatingCurrency(this.config.baseCurrency),
      ...this.config.accounts.map(
        (account) => new Open({ date, account: account.name, bookingMethod: BookingMethod.FIFO })
      ),
      new Open({ date, account: this.config.defaultExpense }),
      new Open({ date, account: this.config.defaultIncome }),
      new Open({ date, account: this.config.pnlAccount }),
      new Open({ date, account: this.config.txFeeAccount })
    )

    return directives
  }

  async getTransaction(combinedTx: TxCombined): Promise<Transaction> {
    const { hash } = combinedTx
    const metadata = { hash }
    const date = DateTime.fromSeconds(combinedTx.timeStamp)
    const beanTx = new Transaction({ date, metadata })
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

    return beanTx
  }

  async getBalances(
    account: Account,
    erc20Transfers: Erc20Transfer[],
    etherscan: Etherscan
  ): Promise<Balance[]> {
    const balances: Balance[] = []
    const tokenMap = new Map<string, Erc20Transfer>()
    erc20Transfers.forEach((transfer) => {
      tokenMap.set(transfer.contractAddress, transfer)
    })
    const tokenInfos = Array.from(tokenMap.values())
    for (let i = 0; i < tokenInfos.length; i++) {
      const tokenInfo = tokenInfos[i]
      console.log(`getting balance for ${tokenInfo.tokenSymbol} (${tokenInfo.contractAddress})`)
      const result = await etherscan.getErc20Balance(account.address, tokenInfo.contractAddress)
      balances.push(
        new Balance({
          account: account.name,
          amount: parseBigNumber(result, Number.parseInt(tokenInfo.tokenDecimal)),
          symbol: new TokenSymbol(tokenInfo.tokenSymbol),
        })
      )
    }

    return balances
  }

  async getNormalTxPostings(normalTx: NormalTx, cost: Cost): Promise<Posting[]> {
    const postings: Posting[] = []
    const value = parseBigNumber(normalTx.value)

    // if value > 0 get postings for ETH transfer
    if (value.gt(0)) {
      postings.push(...this.getEtherTransferPostings(normalTx, value, cost))
    }

    // if transaction is created from the account itself, get postings for tx fee
    if (findAccount(this.config.accounts, normalTx.from)) {
      postings.push(...this.getTxFeePostings(normalTx, cost))
    }

    return postings
  }

  async getErc20TransferPostings(transfer: Erc20Transfer): Promise<Posting[]> {
    const from = getAccountName(transfer.from, AccountType.From, this.config)
    const to = getAccountName(transfer.to, AccountType.To, this.config)
    const amount = parseBigNumber(transfer.value, Number.parseInt(transfer.tokenDecimal))
    const symbol = new TokenSymbol(transfer.tokenSymbol)
    const date = DateTime.fromSeconds(Number.parseInt(transfer.timeStamp))
    const coinInfo = await this.coingecko.getCoinInfo(transfer.contractAddress)
    const costPrice = await this.coingecko.getHistoryPriceByCurrency(
      coinInfo.id,
      date,
      this.config.baseCurrency
    )
    const cost = new Cost({ amount: costPrice, symbol: new TokenSymbol(this.config.baseCurrency) })

    return this.getTransferPostings(from, to, amount, symbol, cost)
  }

  getEtherTransferPostings(tx: BaseTx, amount: Big, cost: Cost, symbol = ETH_SYMBOL): Posting[] {
    const from = getAccountName(tx.from, AccountType.From, this.config)
    const to = getAccountName(tx.to, AccountType.To, this.config)
    return this.getTransferPostings(from, to, amount, symbol, cost)
  }

  getTxFeePostings(normalTx: NormalTx, cost: Cost, symbol = ETH_SYMBOL): Posting[] {
    const from = getAccountName(normalTx.from, AccountType.From, this.config)
    const gasPrice = parseBigNumber(normalTx.gasPrice)
    const amount = gasPrice.mul(normalTx.gasUsed)
    return this.getTransferPostings(from, this.config.txFeeAccount, amount, symbol, cost)
  }

  getTransferPostings(
    fromAccount: string,
    toAccount: string,
    amount: Big,
    symbol: TokenSymbol,
    cost: Cost
  ): Posting[] {
    const fromPosting = new Posting({ account: fromAccount, amount: amount.mul(-1), symbol, cost })
    const toPosting = new Posting({ account: toAccount, amount, symbol, cost })

    if (fromAccount.startsWith("Assets")) {
      const ambiguousCost = new Cost({ ...cost, ambiguous: true })
      fromPosting.cost = ambiguousCost
    }

    return [fromPosting, toPosting]
  }
}

function findAccount(accounts: Account[], accountAddress: string) {
  return accounts.find((acc) => compareAddress(acc.address, accountAddress))
}

function compareAddress(addr1: string, addr2: string): boolean {
  return addr1.toLowerCase() === addr2.toLowerCase()
}

function getAccountName(address: string, accountType: AccountType, config: Config): string {
  const account = config.accounts.find((acc) => compareAddress(acc.address, address.toLowerCase()))
  if (account) {
    return account.name
  } else if (accountType === AccountType.From) {
    return config.defaultIncome
  } else if (accountType === AccountType.To) {
    return config.defaultExpense
  } else {
    throw new Error("unknown account name")
  }
}
