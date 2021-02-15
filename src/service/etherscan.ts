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

  getNormalTransactions(address: string, sort = Sort.Asc): Promise<NormalTx[]> {
    return this.query<NormalTx[]>(address, Module.Account, Action.TxList, sort)
  }

  getInternalTransactions(address: string, sort = Sort.Asc): Promise<InternalTx[]> {
    return this.query<InternalTx[]>(address, Module.Account, Action.TxListInternal, sort)
  }

  getErc20Transfers(address: string, sort = Sort.Asc): Promise<Erc20Transfer[]> {
    return this.query<Erc20Transfer[]>(address, Module.Account, Action.TokenTx, sort)
  }

  getErc20Balance(accountAddress: string, contractAddress: string): Promise<string> {
    return this.query<string>(
      accountAddress,
      Module.Account,
      Action.TokenBalance,
      undefined,
      contractAddress
    )
  }

  async query<T>(
    address: string,
    module: Module,
    action: Action,
    sort?: Sort,
    contractAddress?: string
  ): Promise<T> {
    const { apiKey } = this
    const parameters = new URLSearchParams({
      module,
      action,
      address,
      apiKey,
    })

    if (sort) {
      parameters.append("sort", sort)
    }
    if (contractAddress) {
      parameters.append("contractAddress", contractAddress)
    }

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
  if (res.status === Status.Failure) {
    if (Array.isArray(res.result)) {
      return res.message
    } else {
      return res.result as string
    }
  }
  return ""
}
