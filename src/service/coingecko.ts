import Big from "big.js"
import Bottleneck from "bottleneck"
import { DateTime } from "luxon"
import fetch from "node-fetch"
import { GetCoinInfoResponse } from "./coingecko_model"

const defaultLimiter = new Bottleneck({
  minTime: 500,
  maxConcurrent: 1,
})
export const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3"
export const ETHEREUM_COIN_ID = "ethereum"

type Cache = Record<string, any>

export class CoinGecko {
  readonly baseUrl: string
  readonly limiter: Bottleneck
  cache: Cache

  constructor(baseUrl = COINGECKO_BASE_URL, limiter = defaultLimiter, cache = {}) {
    this.baseUrl = baseUrl
    this.limiter = limiter
    this.cache = cache
  }

  async getCoinInfo(contractAddress: string): Promise<GetCoinInfoResponse> {
    const cacheKey = `getCoinInfo(${contractAddress})`
    const url = `${this.baseUrl}/coins/ethereum/contract/${contractAddress}`

    const cached = this.cache[cacheKey]
    if (cached) {
      return cached
    }

    const result = (await this.limiter.schedule(() =>
      fetch(url).then((res) => res.json())
    )) as GetCoinInfoResponse

    this.cache[cacheKey] = result
    return result
  }

  async getHistoryPrice(coinId: string, date: DateTime): Promise<GetCoinInfoResponse> {
    const cacheKey = `getHistoryPrice(${coinId},${date})`
    const formattedDate = date.toFormat("dd-LL-yyyy")
    const url = `${this.baseUrl}/coins/${coinId}/history?date=${formattedDate}`

    const cached = this.cache[cacheKey]
    if (cached) {
      return cached
    }

    const text = await this.limiter.schedule(() => fetch(url).then((res) => res.text()))
    const result = JSON.parse(text) as GetCoinInfoResponse

    this.cache[cacheKey] = result
    return result
  }

  async getHistoryPriceByCurrency(coinId: string, date: DateTime, currency: string): Promise<Big> {
    const historyPrice = await this.getHistoryPrice(coinId, date)
    const matched = historyPrice.market_data?.current_price[currency.toLowerCase()]
    if (matched) {
      return new Big(matched)
    } else {
      return new Big(0)
    }
  }
}
