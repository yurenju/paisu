import Big from "big.js"
import { DateTime } from "luxon"
import { Posting, Transaction } from "../beancount"
import { Config } from "../config"
import { BaseTx, NormalTx } from "../service/etherscan"
import { ETH_DECIMALS, ETH_SYMBOL, TxCombined } from "./ethereum"

enum AccountType {
  From = "from",
  To = "to",
}

export function roastBean(combinedTx: TxCombined, config: Config): Transaction {
  const metadata = {
    hash: combinedTx.hash,
  }
  const date = DateTime.fromSeconds(combinedTx.timeStamp)
  const beanTx = new Transaction({ date, metadata })

  if (combinedTx.normalTx) {
    const postings = getNormalTxPostings(combinedTx.normalTx, config)
    beanTx.postings.push(...postings)
  }
  if (combinedTx.internalTxs.length > 0) {
    const postings = combinedTx.internalTxs.map((internalTx) => {
      const value = new Big(internalTx.value).div(new Big(10).pow(ETH_DECIMALS))
      return getEtherTransferPostings(internalTx, value, config)
    })
    beanTx.postings.push(...postings.flat())
  }

  return beanTx
}

export function getNormalTxPostings(normalTx: NormalTx, config: Config): Posting[] {
  const postings: Posting[] = []

  const value = new Big(normalTx.value).div(new Big(10).pow(ETH_DECIMALS))

  // if value > 0 get postings for ETH transfer
  if (value.gt(0)) {
    postings.push(...getEtherTransferPostings(normalTx, value, config))
  }

  // if transaction is created from the account itself, get postings for tx fee
  const fromOwnAccounts = config.accounts.find((acc) => compareAddress(acc.address, normalTx.from))
  if (fromOwnAccounts) {
    postings.push(...getTxFeePostings(normalTx, config))
  }

  return postings
}

function getEtherTransferPostings(
  tx: BaseTx,
  amount: Big,
  config: Config,
  symbol = ETH_SYMBOL
): Posting[] {
  const postings: Posting[] = []
  const from = getAccountName(tx.from, AccountType.From, config)
  const to = getAccountName(tx.to, AccountType.To, config)

  postings.push(new Posting({ account: from, symbol, amount: amount.mul(-1) }))
  postings.push(new Posting({ account: to, symbol, amount }))
  return postings
}

function getTxFeePostings(
  normalTx: NormalTx,
  config: Config,
  symbol = ETH_SYMBOL,
  decimals = ETH_DECIMALS
): Posting[] {
  const postings: Posting[] = []
  const from = getAccountName(normalTx.from, AccountType.From, config)
  const amount = new Big(normalTx.gasPrice).mul(normalTx.gasUsed).div(new Big(10).pow(decimals))

  postings.push(new Posting({ account: from, symbol, amount: amount.mul(-1) }))
  postings.push(new Posting({ account: config.txFeeAccount, symbol, amount }))

  return postings
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
