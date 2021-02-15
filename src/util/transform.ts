import Big from "big.js"
import { DateTime } from "luxon"
import { Posting, Transaction } from "../beancount"
import { Config } from "../config"
import { BaseTx, Erc20Transfer, NormalTx } from "../service/etherscan"
import { ETH_DECIMALS, ETH_SYMBOL, TxCombined } from "./ethereum"
import { parseBigNumber } from "./misc"

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

  // normal transaction
  if (combinedTx.normalTx) {
    const postings = getNormalTxPostings(combinedTx.normalTx, config)
    beanTx.postings.push(...postings)
  }

  // internal transactions
  const internalTxPostings = combinedTx.internalTxs.map((internalTx) => {
    const value = parseBigNumber(internalTx.value)
    return getEtherTransferPostings(internalTx, value, config)
  })
  beanTx.postings.push(...internalTxPostings.flat())

  // erc20 transfers
  const erc20TransferPostings = combinedTx.erc20Transfers.map((erc20Transfer) =>
    getErc20TransferPostings(erc20Transfer, config)
  )
  beanTx.postings.push(...erc20TransferPostings.flat())

  return beanTx
}

export function getNormalTxPostings(normalTx: NormalTx, config: Config): Posting[] {
  const postings: Posting[] = []
  const value = parseBigNumber(normalTx.value)

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

export function getErc20TransferPostings(transfer: Erc20Transfer, config: Config): Posting[] {
  const postings: Posting[] = []
  const from = getAccountName(transfer.from, AccountType.From, config)
  const to = getAccountName(transfer.to, AccountType.To, config)
  const amount = parseBigNumber(transfer.value, Number.parseInt(transfer.tokenDecimal))
  const symbol = transfer.tokenSymbol.toUpperCase()
  postings.push(new Posting({ account: from, symbol, amount: amount.mul(-1) }))
  postings.push(new Posting({ account: to, symbol, amount }))

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
  const gasPrice = parseBigNumber(normalTx.gasPrice)
  const amount = gasPrice.mul(normalTx.gasUsed)

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
