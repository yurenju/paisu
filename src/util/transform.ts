import Big from "big.js"
import { Cost, Posting, TokenSymbol } from "../beancount"
import { Account, Config } from "../config"
import { Erc20Transfer } from "../service/etherscan_model"
import { TxCombined } from "./ethereum"

export enum AccountType {
  From = "from",
  To = "to",
}

export interface TokenInfo {
  address: string
  symbol: TokenSymbol
  decimal: number
}

export function findAccount(accounts: Account[], accountAddress: string) {
  return accounts.find((acc) => compareAddress(acc.address, accountAddress))
}

export function compareAddress(addr1: string, addr2: string): boolean {
  return addr1.toLowerCase() === addr2.toLowerCase()
}

export function getAccountName(address: string, accountType: AccountType, config: Config): string {
  const account = config.accounts.find((acc) => compareAddress(acc.address, address))
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

export function getBlockNumber(combinedTx: TxCombined): string {
  if (combinedTx.normalTx) {
    return combinedTx.normalTx.blockNumber
  } else if (combinedTx.internalTxs.length > 0) {
    return combinedTx.internalTxs[0].blockNumber
  } else {
    return combinedTx.erc20Transfers[0].blockNumber
  }
}

export function getTokenInfosByTransfers(erc20Transfers: Erc20Transfer[]): TokenInfo[] {
  const tokenMap = new Map<string, Erc20Transfer>()
  erc20Transfers.forEach((transfer) => {
    tokenMap.set(transfer.contractAddress, transfer)
  })
  return Array.from(tokenMap.values()).map((transfer) => {
    return {
      address: transfer.contractAddress,
      symbol: new TokenSymbol(transfer.tokenSymbol),
      decimal: Number.parseInt(transfer.tokenDecimal),
    }
  })
}

export function isAsset(address: string, accountType: AccountType, config: Config): boolean {
  return getAccountName(address, accountType, config).startsWith("Assets")
}

export function isExchange(combinedTx: TxCombined, config: Config): boolean {
  let fromAsset = false
  let toAsset = false

  function checkAsset(from: string, to: string) {
    if (isAsset(from, AccountType.From, config)) {
      fromAsset = true
    }
    if (isAsset(to, AccountType.To, config)) {
      toAsset = true
    }
  }

  if (combinedTx.normalTx) {
    checkAsset(combinedTx.normalTx.from, combinedTx.normalTx.to)
  }
  combinedTx.erc20Transfers.forEach((tx) => checkAsset(tx.from, tx.to))
  combinedTx.internalTxs.forEach((tx) => checkAsset(tx.from, tx.to))

  return fromAsset && toAsset
}

export function getTransferPostings(
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
