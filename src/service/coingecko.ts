import Big from "big.js"
import Bottleneck from "bottleneck"
import { DateTime } from "luxon"
import fetch from "node-fetch"
import { Cache } from "../util/cache"
import { GetCoinInfoResponse } from "./coingecko_model"

const defaultCache = Cache.load("coingecko.cache")
const defaultLimiter = new Bottleneck({
  minTime: 1000,
  maxConcurrent: 1,
})
export const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3"
export const ETHEREUM_COIN_ID = "ethereum"

export class CoinGecko {
  readonly baseUrl: string
  readonly limiter: Bottleneck
  cache: Cache

  constructor(baseUrl = COINGECKO_BASE_URL, limiter = defaultLimiter, cache = defaultCache) {
    this.baseUrl = baseUrl
    this.limiter = limiter
    this.cache = cache
  }

  async getCoinInfo(contractAddress: string): Promise<GetCoinInfoResponse> {
    const cacheKey = `getCoinInfo(${contractAddress})`
    const url = `${this.baseUrl}/coins/ethereum/contract/${contractAddress}`

    const cached = this.cache.get(cacheKey)
    if (cached) {
      return JSON.parse(cached) as GetCoinInfoResponse
    }

    const text = await this.limiter.schedule(() => fetch(url).then((res) => res.text()))
    try {
      const result = JSON.parse(text) as GetCoinInfoResponse
      await this.cache.put(cacheKey, text)
      return result
    } catch (e) {
      console.log(text)
      throw e
    }
  }

  async getHistoryPrice(coinId: string, date: DateTime): Promise<GetCoinInfoResponse> {
    const cacheKey = `getHistoryPrice(${coinId},${date})`
    const formattedDate = date.toFormat("dd-LL-yyyy")
    const url = `${this.baseUrl}/coins/${coinId}/history?date=${formattedDate}`

    const cached = this.cache.get(cacheKey)
    if (cached) {
      return JSON.parse(cached) as GetCoinInfoResponse
    }

    const text = await this.limiter.schedule(() => fetch(url).then((res) => res.text()))
    try {
      const result = JSON.parse(text) as GetCoinInfoResponse
      await this.cache.put(cacheKey, text)
      return result
    } catch (e) {
      console.log(text)
      throw e
    }
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
