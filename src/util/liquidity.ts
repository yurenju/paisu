import Big from "big.js"
import { Contract, getDefaultProvider } from "ethers"
import { TokenSymbol } from "../beancount"
import { CoinGecko } from "../service/coingecko"
import { getTokenInfo } from "./ethereum"
import { UNISWAP_LIQUIDITY_ABI } from "./liquidity_abi"
import { parseBigNumber } from "./misc"
import { TokenInfo } from "./transform"

export interface PairToken {
  symbol: TokenSymbol
  contractAddress: string
  balance: Big
}
export interface Pair {
  token0: PairToken
  token1: PairToken
}

export async function getUniswapLiquidityTokenPrice(
  liquidityTokenAddress: string,
  coingecko: CoinGecko,
  baseCurrency: string
) {
  const pair = await getUniswapLiquidityPair(liquidityTokenAddress)
  const coinInfo0 = await coingecko.getCoinInfoByContractAddress(pair.token0.contractAddress)
  const coinInfo1 = await coingecko.getCoinInfoByContractAddress(pair.token1.contractAddress)
  const price0 = coinInfo0.market_data.current_price[baseCurrency.toLowerCase()]
  const price1 = coinInfo1.market_data.current_price[baseCurrency.toLowerCase()]
  return pair.token0.balance.mul(price0).plus(pair.token1.balance.mul(price1))
}

async function getUniswapLiquidityPair(
  liquidityTokenAddress: string,
  provider = getDefaultProvider()
): Promise<Pair> {
  const lpToken = new Contract(liquidityTokenAddress, UNISWAP_LIQUIDITY_ABI, provider)
  const lpDecimal = await lpToken.decimals()
  const lpAmount = new Big(1)
  const lpTotalSupply = parseBigNumber(await lpToken.totalSupply(), lpDecimal)
  const [reserve0, reserve1] = await lpToken.getReserves()
  const [token0Addr, token1Addr] = await Promise.all([lpToken.token0(), lpToken.token1()])
  const tokenInfo0 = await getTokenInfo(token0Addr)
  const tokenInfo1 = await getTokenInfo(token1Addr)

  return {
    token0: getPairToken(tokenInfo0, reserve0, lpAmount, lpTotalSupply),
    token1: getPairToken(tokenInfo1, reserve1, lpAmount, lpTotalSupply),
  }
}

export function getPairToken(
  tokenInfo: TokenInfo,
  reserve: number,
  lpAmount: Big,
  lpTotalSupply: Big
): PairToken {
  return {
    contractAddress: tokenInfo.address,
    symbol: tokenInfo.symbol,
    balance: lpAmount
      .mul(reserve.toString())
      .div(lpTotalSupply)
      .div(new Big(10).pow(tokenInfo.decimal)),
  }
}
