import Big from "big.js"
import { ETH_DECIMALS } from "./ethereum"

export function copyValues(from: any, to: any) {
  Object.entries(from).forEach(([key, value]) => {
    to[key] = value
  })
}

export function parseBigNumber(value: string, decimals: number = ETH_DECIMALS) {
  return new Big(value).div(new Big(10).pow(decimals))
}
