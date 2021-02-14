import fetch from "node-fetch"
import Bottleneck from "bottleneck"
import { URLSearchParams } from "url"

export interface BaseTx {
  blockNumber: string
  timeStamp: string
  hash: string
  from: string
  to: string
  contractAddress: string
  value: string
  gas: string
  gasUsed: string
}

export interface Erc20Transfer extends BaseTx {
  nonce: string
  blockHash: string
  tokenName: string
  tokenSymbol: string
  tokenDecimal: string
  transactionIndex: string
  gasPrice: string
  cumulativeGasUsed: string
  input: string
  confirmations: string
}

export interface InternalTx extends BaseTx {
  input: string
  type: string
  traceId: string
  isError: string
  errCode: string
}

export interface NormalTx extends BaseTx {
  nonce: string
  blockHash: string
  transactionIndex: string
  gasPrice: string
  isError: string
  txreceipt_status: string
  input: string
  cumulativeGasUsed: string
  confirmations: string
}

enum Status {
  Failure = "0",
  Success = "1",
}

interface Response<T> {
  status: Status
  message: string
  result: T[] | string
}

enum Sort {
  Asc = "asc",
  Desc = "desc",
}

enum Module {
  Account = "account",
}

enum Action {
  TxList = "txlist",
  TxListInternal = "txlistinternal",
  TokenTx = "tokentx",
}

interface Parameters {
  [key: string]: string
  module: Module
  action: Action
  address: string
  sort: Sort
  apiKey: string
}

const ETHERSCAN_BASE_URL = "https://api.etherscan.io/api"

const defaultLimiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 200,
})

export class Etherscan {
  readonly apiKey: string
  readonly rateLimit: number
  readonly baseUrl: string
  readonly limiter: Bottleneck

  constructor(
    apiKey: string,
    rateLimit = 5,
    baseUrl = ETHERSCAN_BASE_URL,
    limiter = defaultLimiter
  ) {
    this.apiKey = apiKey
    this.rateLimit = rateLimit
    this.baseUrl = baseUrl
    this.limiter = limiter
  }

  getNormalTransactions(address: string, sort = Sort.Asc): Promise<NormalTx[]> {
    return this.query<NormalTx>(address, sort, Module.Account, Action.TxList)
  }

  getInternalTransactions(address: string, sort = Sort.Asc): Promise<InternalTx[]> {
    return this.query<InternalTx>(address, sort, Module.Account, Action.TxListInternal)
  }

  getErc20Transfers(address: string, sort = Sort.Asc): Promise<Erc20Transfer[]> {
    return this.query<Erc20Transfer>(address, sort, Module.Account, Action.TokenTx)
  }

  async query<T>(address: string, sort: Sort, module: Module, action: Action): Promise<T[]> {
    const { apiKey } = this
    const parameters = new URLSearchParams({
      module,
      action,
      address,
      sort,
      apiKey,
    }).toString()
    const query = `${this.baseUrl}?${parameters}`
    const res = (await this.limiter.schedule(() =>
      fetch(query).then((res) => res.json())
    )) as Response<T>

    const errorMessage = getErrorMessage(res)

    if (errorMessage) {
      throw new Error(errorMessage)
    }

    if (!Array.isArray(res.result)) {
      throw new Error("result is not an array")
    }

    return res.result
  }
}

function getErrorMessage<T>(res: Response<T>): string {
  if (res.status === Status.Failure) {
    if (Array.isArray(res.result)) {
      return res.message
    } else {
      return res.result
    }
  }
  return ""
}
