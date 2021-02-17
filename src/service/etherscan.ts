import fetch from "node-fetch"
import Bottleneck from "bottleneck"
import { URLSearchParams } from "url"
import {
  Sort,
  NormalTx,
  Module,
  Action,
  InternalTx,
  Erc20Transfer,
  Response,
  Status,
  QueryProps,
} from "./etherscan_model"

const ETHERSCAN_BASE_URL = "https://api.etherscan.io/api"

const defaultLimiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 200,
})

export class Etherscan {
  readonly apiKey: string
  readonly baseUrl: string
  readonly limiter: Bottleneck

  constructor(apiKey: string, baseUrl = ETHERSCAN_BASE_URL, limiter = defaultLimiter) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.limiter = limiter
  }

  getNormalTransactions(
    address: string,
    startBlock?: number,
    sort = Sort.Asc
  ): Promise<NormalTx[]> {
    const { apiKey } = this
    return this.query<NormalTx[]>({
      apiKey,
      address,
      module: Module.Account,
      action: Action.TxList,
      sort,
      startBlock,
    })
  }

  getInternalTransactions(
    address: string,
    startBlock?: number,
    sort = Sort.Asc
  ): Promise<InternalTx[]> {
    const { apiKey } = this
    return this.query<InternalTx[]>({
      apiKey,
      address,
      module: Module.Account,
      action: Action.TxListInternal,
      sort,
      startBlock,
    })
  }

  getErc20Transfers(
    address: string,
    startBlock?: number,
    sort = Sort.Asc
  ): Promise<Erc20Transfer[]> {
    const { apiKey } = this
    return this.query<Erc20Transfer[]>({
      apiKey,
      address,
      module: Module.Account,
      action: Action.TokenTx,
      sort,
      startBlock,
    })
  }

  getErc20Balance(accountAddress: string, contractAddress: string): Promise<string> {
    const { apiKey } = this
    return this.query<string>({
      apiKey,
      address: accountAddress,
      module: Module.Account,
      action: Action.TokenBalance,
      contractAddress,
    })
  }

  async query<T>(props: QueryProps): Promise<T> {
    const parameters = new URLSearchParams(props as any)
    const query = `${this.baseUrl}?${parameters.toString()}`
    const res = (await this.limiter.schedule(() =>
      fetch(query).then((res) => res.json())
    )) as Response<T>

    const errorMessage = getErrorMessage(res)

    if (errorMessage) {
      throw new Error(errorMessage)
    }

    return res.result as T
  }
}

function getErrorMessage<T>(res: Response<T>): string {
  if (res.status === Status.Failure && !Array.isArray(res.result)) {
    return res.result as string
  }
  return ""
}
