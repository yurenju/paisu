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
