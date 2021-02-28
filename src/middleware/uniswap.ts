import { Interface } from "ethers/lib/utils"
import { DateTime } from "luxon"
import { Middleware, RoastedResult } from "."
import { Cost, Posting, TokenSymbol, Transaction } from "../beancount"
import { Price } from "../beancount/price"
import { Config } from "../config"
import { CoinGecko, ETHEREUM_COIN_ID } from "../service/coingecko"
import { Erc20Transfer, InternalTx, NormalTx } from "../service/etherscan_model"
import { TxCombined } from "../util/ethereum"
import { getUniswapLiquidityTokenPrice } from "../util/liquidity"
import { parseBigNumber } from "../util/misc"
import {
  AccountType,
  compareAddress,
  getAccountName,
  getTokenInfosByTransfers,
} from "../util/transform"
import { UNISWAP_ROUTER_ABI } from "./uniswap_abi"

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
        const amount = await getUniswapLiquidityTokenPrice(
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
