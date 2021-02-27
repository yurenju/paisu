import Big from "big.js"
import { Contract, getDefaultProvider } from "ethers"
import { Interface } from "ethers/lib/utils"
import { DateTime } from "luxon"
import { Middleware, RoastedResult } from "."
import { Cost, Posting, TokenSymbol, Transaction } from "../beancount"
import { Price } from "../beancount/price"
import { Config } from "../config"
import { CoinGecko, ETHEREUM_COIN_ID } from "../service/coingecko"
import { Erc20Transfer, InternalTx, NormalTx } from "../service/etherscan_model"
import { getTokenInfo, TxCombined } from "../util/ethereum"
import { parseBigNumber } from "../util/misc"
import {
  AccountType,
  compareAddress,
  getAccountName,
  getTokenInfosByTransfers,
  TokenInfo,
} from "../util/transform"
import { UNISWAP_LIQUIDITY_ABI, UNISWAP_ROUTER_ABI } from "./uniswap_abi"

interface LiquidityTokens {
  [contractAddress: string]: TokenSymbol
}

enum LiquidityAction {
  Add,
  Remove,
}

export class UniswapMiddleware implements Middleware {
  readonly router2Address = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d"
  liquidityTokens: LiquidityTokens = {}
  coingecko: CoinGecko
  config: Config

  constructor(coingecko: CoinGecko, config: Config) {
    this.coingecko = coingecko
    this.config = config
  }

  async roastTransaction(combinedTx: TxCombined, beanTx: Transaction): Promise<void> {
    if (combinedTx.normalTx && compareAddress(combinedTx.normalTx.to, this.router2Address)) {
      const tx = combinedTx.normalTx
      const routerInterface = new Interface(UNISWAP_ROUTER_ABI)
      const description = routerInterface.parseTransaction({ data: tx.input, value: tx.value })

      switch (description.name) {
        case "swapExactTokensForTokens": {
          if (tx.isError === "1") {
            beanTx.narration = `Swap failed on Uniswap`
          } else {
            const fromToken = combinedTx.erc20Transfers.find((transfer) =>
              compareAddress(description.args.path[0], transfer.contractAddress)
            )
            const toToken = combinedTx.erc20Transfers.find((transfer) =>
              compareAddress(description.args.path.slice().pop(), transfer.contractAddress)
            )

            const fromAmount = parseBigNumber(
              fromToken!.value,
              Number.parseInt(fromToken!.tokenDecimal)
            )
            const toAmount = parseBigNumber(toToken!.value, Number.parseInt(toToken!.tokenDecimal))

            beanTx.narration = `Swap ${fromAmount} ${fromToken?.tokenSymbol} -> ${toAmount} ${toToken?.tokenSymbol} on Uniswap`
          }
          break
        }
        case "swapExactTokensForETH": {
          const fromToken = combinedTx.erc20Transfers.find((transfer) =>
            compareAddress(description.args.path[0], transfer.contractAddress)
          )
          beanTx.narration = `Swap ${fromToken?.tokenSymbol} -> ETH on Uniswap`
          break
        }
        case "swapExactETHForTokens": {
          const fromToken = combinedTx.erc20Transfers.find((transfer) =>
            compareAddress(description.args.path.slice().pop(), transfer.contractAddress)
          )
          beanTx.narration = `Swap ETH -> ${fromToken?.tokenSymbol} on Uniswap`
          break
        }
        case "addLiquidityETH": {
          await this.handleLiquidity(
            combinedTx,
            beanTx,
            description.args.token,
            LiquidityAction.Add
          )
          break
        }
        case "removeLiquidityETH": {
          await this.handleLiquidity(
            combinedTx,
            beanTx,
            description.args.token,
            LiquidityAction.Remove
          )
          break
        }

        default:
          break
      }
    }

    combinedTx.erc20Transfers.forEach((transfer) => {
      const lpTokenSymbol = this.liquidityTokens[transfer.contractAddress]
      if (lpTokenSymbol) {
        transfer.tokenSymbol = `${lpTokenSymbol}`
      }
    })

    return Promise.resolve()
  }

  async roastRestBeans(
    date: DateTime,
    combinedTxs: TxCombined[],
    normalTxs: NormalTx[],
    internalTxs: InternalTx[],
    erc20Transfers: Erc20Transfer[],
    result: RoastedResult
  ): Promise<void> {
    const tokenInfos = getTokenInfosByTransfers(erc20Transfers)
    for (let i = 0; i < tokenInfos.length; i++) {
      const tokenInfo = tokenInfos[i]
      if (this.liquidityTokens[tokenInfo.address]) {
        const holding = this.liquidityTokens[tokenInfo.address]
        const amount = await getLiquidityTokenPrice(
          tokenInfo.address,
          this.coingecko,
          this.config.baseCurrency
        )
        result.prices.push(
          new Price({
            date: DateTime.local(),
            holding,
            amount,
            symbol: new TokenSymbol(this.config.baseCurrency),
          })
        )
      }
    }
    return Promise.resolve()
  }

  async handleLiquidity(
    combinedTx: TxCombined,
    beanTx: Transaction,
    tokenAddress: string,
    action: LiquidityAction
  ) {
    const token = combinedTx.erc20Transfers.find((transfer) =>
      compareAddress(tokenAddress, transfer.contractAddress)
    )
    const lpTokenIndex = combinedTx.erc20Transfers.findIndex(
      (transfer) => transfer.tokenSymbol === "UNI-V2"
    )

    if (token && lpTokenIndex !== -1) {
      const lpTokenTransfer = combinedTx.erc20Transfers[lpTokenIndex]
      lpTokenTransfer.tokenSymbol = `UNI-LP-${token.tokenSymbol}`
      this.liquidityTokens[lpTokenTransfer.contractAddress] = new TokenSymbol(
        lpTokenTransfer.tokenSymbol
      )

      if (action === LiquidityAction.Add) {
        beanTx.narration = `Add ${token?.tokenSymbol} liquidity to Uniswap`
        const ethCostPrice = await this.coingecko.getHistoryPriceByCurrency(
          ETHEREUM_COIN_ID,
          DateTime.fromSeconds(combinedTx.timeStamp),
          this.config.baseCurrency
        )
        const lpAmount = parseBigNumber(
          lpTokenTransfer.value,
          Number.parseInt(lpTokenTransfer.tokenDecimal)
        )
        const ethValue = parseBigNumber(combinedTx.normalTx!.value)
        const lpCost = new Cost({
          amount: ethCostPrice.mul(ethValue).mul(2).div(lpAmount),
          symbol: new TokenSymbol(this.config.baseCurrency),
        })
        const lpPosting = new Posting({
          account: getAccountName(combinedTx.normalTx!.from, AccountType.To, this.config),
          amount: lpAmount,
          symbol: new TokenSymbol(lpTokenTransfer.tokenSymbol),
          cost: lpCost,
        })
        beanTx.postings.push(lpPosting)
        combinedTx.erc20Transfers.splice(lpTokenIndex, 1)
      } else {
        beanTx.narration = `Remove ${token?.tokenSymbol} liquidity to Uniswap`
      }
    }
  }
}

interface PairToken {
  symbol: TokenSymbol
  contractAddress: string
  balance: Big
}
interface Pair {
  token0: PairToken
  token1: PairToken
}

export async function getLiquidityTokenPrice(
  liquidityTokenAddress: string,
  coingecko: CoinGecko,
  baseCurrency: string
) {
  const pair = await getLiquidityPair(liquidityTokenAddress)
  const coinInfo0 = await coingecko.getCoinInfoByContractAddress(pair.token0.contractAddress)
  const coinInfo1 = await coingecko.getCoinInfoByContractAddress(pair.token1.contractAddress)
  const price0 = coinInfo0.market_data.current_price[baseCurrency.toLowerCase()]
  const price1 = coinInfo1.market_data.current_price[baseCurrency.toLowerCase()]
  return pair.token0.balance.mul(price0).plus(pair.token1.balance.mul(price1))
}

async function getLiquidityPair(
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

function getPairToken(
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
