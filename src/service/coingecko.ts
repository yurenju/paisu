import Big from "big.js"
import Bottleneck from "bottleneck"
import { constants } from "ethers"
import { DateTime } from "luxon"
import fetch from "node-fetch"
import { Cache } from "../util/cache"
import { GetCoinInfoResponse, MarketChartResponse } from "./coingecko_model"

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

  async getCoinInfoByContractAddress(contractAddress: string): Promise<GetCoinInfoResponse> {
    if (contractAddress === constants.AddressZero) {
      return this.getCoinInfoById(ETHEREUM_COIN_ID)
    } else {
      const path = `/coins/ethereum/contract/${contractAddress}`
      return this.getCoinInfo(path)
    }
  }

  async getCoinInfoById(coinId: string): Promise<GetCoinInfoResponse> {
    const path = `/coins/${coinId}`
    return this.getCoinInfo(path)
  }

  async getCoinInfo(path: string): Promise<GetCoinInfoResponse> {
    const cacheKey = path
    const url = `${this.baseUrl}${path}`

    let text = this.cache.get(cacheKey)
    if (!text) {
      text = await this.limiter.schedule(() => fetch(url).then((res) => res.text()))
    }

    try {
      const result = JSON.parse(text)
      if (result.error) {
        throw new Error(result.error)
      }

      await this.cache.put(cacheKey, text)
      return result as GetCoinInfoResponse
    } catch (e) {
      console.log(url, text)
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

  async getHistoricalMarketData(
    coinId: string,
    fiat: string,
    days = "max",
    interval = "daily"
  ): Promise<MarketChartResponse> {
    const url = `${this.baseUrl}/coins/${coinId}/market_chart?vs_currency=${fiat}&days=${days}&interval=${interval}`
    const text = await this.limiter.schedule(() => fetch(url).then((res) => res.text()))

    try {
      return JSON.parse(text) as MarketChartResponse
    } catch (e) {
      console.log(text)
      throw e
    }
  }

  async getHistoricalMarketDataByContractAddress(
    contractAddress: string,
    fiat: string,
    days = "max",
    interval = "daily"
  ) {
    return this.getCoinInfoByContractAddress(contractAddress).then((coinInfo) =>
      this.getHistoricalMarketData(coinInfo.id, fiat, days, interval)
    )
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

  async getHistoryPriceByContractAddress(
    contractAddress: string,
    date: DateTime,
    currency: string
  ): Promise<Big> {
    const coinInfo = await this.getCoinInfoByContractAddress(contractAddress)
    return await this.getHistoryPriceByCurrency(coinInfo.id, date, currency)
  }
}
