import Bottleneck from "bottleneck"
import fetch from "node-fetch"
import { URLSearchParams } from "url"
import { Cache } from "../util/cache"
import {
  Action,
  Erc20Transfer,
  InternalTx,
  Module,
  NormalTx,
  QueryProps,
  Response,
  Sort,
  Status,
} from "./etherscan_model"

const ETHERSCAN_BASE_URL = "https://api.etherscan.io/api"
const DEFAULT_OFFSET = 10000

const defaultCache = Cache.load("etherscan.cache")
const defaultLimiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 200,
})

export class Etherscan {
  readonly apiKey: string
  readonly baseUrl: string
  readonly limiter: Bottleneck
  readonly cache: Cache

  constructor(
    apiKey: string,
    baseUrl = ETHERSCAN_BASE_URL,
    limiter = defaultLimiter,
    cache = defaultCache
  ) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.limiter = limiter
    this.cache = cache
  }

  getNormalTransactions(
    address: string,
    startBlock?: number,
    sort = Sort.Asc,
    offset = DEFAULT_OFFSET
  ): Promise<NormalTx[]> {
    const { apiKey } = this
    return this.query<NormalTx[]>(
      {
        apiKey,
        address,
        module: Module.Account,
        action: Action.TxList,
        sort,
        offset,
        startBlock,
      },
      true
    )
  }

  getInternalTransactions(
    address: string,
    startBlock?: number,
    sort = Sort.Asc,
    offset = DEFAULT_OFFSET
  ): Promise<InternalTx[]> {
    const { apiKey } = this
    return this.query<InternalTx[]>(
      {
        apiKey,
        address,
        module: Module.Account,
        action: Action.TxListInternal,
        sort,
        offset,
        startBlock,
      },
      true
    )
  }

  getErc20Transfers(
    address: string,
    startBlock?: number,
    sort = Sort.Asc,
    offset = DEFAULT_OFFSET
  ): Promise<Erc20Transfer[]> {
    const { apiKey } = this
    return this.query<Erc20Transfer[]>(
      {
        apiKey,
        address,
        module: Module.Account,
        action: Action.TokenTx,
        sort,
        offset,
        startBlock,
      },
      true
    )
  }

  getErc20Balance(accountAddress: string, contractAddress: string): Promise<string> {
    const { apiKey } = this
    return this.query<string>(
      {
        apiKey,
        address: accountAddress,
        module: Module.Account,
        action: Action.TokenBalance,
        contractAddress,
      },
      true
    )
  }

  getEthBalance(accountAddress: string): Promise<string> {
    const { apiKey } = this
    return this.query<string>(
      {
        apiKey,
        address: accountAddress,
        module: Module.Account,
        action: Action.Balance,
      },
      true
    )
  }

  async query<T>(props: QueryProps, noCache = false): Promise<T> {
    const parameters = new URLSearchParams(props as any).toString()
    const cached = this.cache.get(parameters)

    if (!cached || noCache) {
      const query = `${this.baseUrl}?${parameters}`
      const res = (await this.limiter.schedule(() =>
        fetch(query).then((res) => res.json())
      )) as Response<T>

      const errorMessage = getErrorMessage(res)

      if (errorMessage) {
        throw new Error(errorMessage)
      }

      await this.cache.put(parameters, JSON.stringify(res.result))
      return res.result as T
    }

    return JSON.parse(cached) as T
  }
}

function getErrorMessage<T>(res: Response<T>): string {
  if (res.status === Status.Failure && !Array.isArray(res.result)) {
    return res.result as string
  }
  return ""
}
