import { Interface } from "@ethersproject/abi"
import { Contract } from "@ethersproject/contracts"
import { getDefaultProvider } from "@ethersproject/providers"
import Big from "big.js"
import { DateTime } from "luxon"
import fetch from "node-fetch"
import { Middleware, RoastedResult } from "."
import { TokenSymbol, Transaction } from "../beancount"
import { Price } from "../beancount/price"
import { Config } from "../config"
import { CoinGecko } from "../service/coingecko"
import { Erc20Transfer, InternalTx, NormalTx } from "../service/etherscan_model"
import { getTokenInfo, TxCombined } from "../util/ethereum"
import { getPairToken } from "../util/liquidity"
import { parseBigNumber } from "../util/misc"
import { compareAddress, getTokenInfosByTransfers } from "../util/transform"
import { ONE_INCH_EXCHANGE_V2_ABI, ONE_INCH_LP_ABI, ONE_INCH_LP_FARM_ABI } from "./1inch_abi"
import { OneInchFarmingInfo, OneInchTokenInfo } from "./1inch_model"

const ONE_INCH_EXCHANGE_V2_ADDR = "0x111111125434b319222cdbf8c261674adb56f3ae"
const ONE_INCH_TOKEN_BASEURL = "https://tokens.1inch.exchange/v1.0"
const ONE_INCH_FARMING_URL = "https://governance.1inch.exchange/v1.1/farming/poolDetails/"
const MOONISWAP_TOKENS_URL = `${ONE_INCH_TOKEN_BASEURL}/tokens/pool/mooniswap`
export class OneInchMiddleware implements Middleware {
  mooniswapTokenMap: Map<string, OneInchTokenInfo> = new Map()
  farmingInfos: OneInchFarmingInfo[] = []
  coingecko: CoinGecko
  config: Config

  constructor(coingecko: CoinGecko, config: Config) {
    this.coingecko = coingecko
    this.config = config
  }

  async roastTransaction(combinedTx: TxCombined, beanTx: Transaction): Promise<void> {
    if (!combinedTx.normalTx) {
      return Promise.resolve()
    }

    if (this.mooniswapTokenMap.size === 0) {
      const json = await fetch(MOONISWAP_TOKENS_URL).then((res) => res.json())
      this.mooniswapTokenMap = new Map(Object.entries(json))
    }

    if (this.farmingInfos.length === 0) {
      this.farmingInfos = (await fetch(ONE_INCH_FARMING_URL).then((res) =>
        res.json()
      )) as OneInchFarmingInfo[]
    }

    const tx = combinedTx.normalTx
    if (compareAddress(tx.to, ONE_INCH_EXCHANGE_V2_ADDR)) {
      const exchangeInterface = new Interface(ONE_INCH_EXCHANGE_V2_ABI)
      const desc = exchangeInterface.parseTransaction({ data: tx.input, value: tx.value })

      if (desc.name === "swap") {
        const fromToken = combinedTx.erc20Transfers.find((transfer) =>
          compareAddress(desc.args.desc.srcToken, transfer.contractAddress)
        )
        const toToken = combinedTx.erc20Transfers.find((transfer) =>
          compareAddress(desc.args.desc.dstToken, transfer.contractAddress)
        )

        const fromAmount = parseBigNumber(
          fromToken!.value,
          Number.parseInt(fromToken!.tokenDecimal)
        )
        const toAmount = parseBigNumber(toToken!.value, Number.parseInt(toToken!.tokenDecimal))

        if (tx.isError === "1") {
          beanTx.narration = `Swap failed on 1inch`
        } else {
          beanTx.narration = `Swap ${fromAmount} ${new TokenSymbol(
            fromToken!.tokenSymbol
          )} -> ${toAmount} ${new TokenSymbol(toToken!.tokenSymbol)} on 1inch`
        }
      }
    } else if (this.farmingInfos.find((info) => compareAddress(info.farmingAddress, tx.to))) {
      const lpInterface = new Interface(ONE_INCH_LP_FARM_ABI)
      const desc = lpInterface.parseTransaction({ data: tx.input, value: tx.value })

      if (desc.name === "stake") {
        const token = combinedTx.erc20Transfers.find((transfer) =>
          compareAddress(transfer.to, tx.to)
        )

        const amount = parseBigNumber(token!.value, Number.parseInt(token!.tokenDecimal))
        beanTx.narration = `Stake ${amount} ${new TokenSymbol(token!.tokenSymbol)} on 1inch`
      }

      if (desc.name === "getReward" && combinedTx.erc20Transfers.length > 0) {
        const transfer = combinedTx.erc20Transfers[0]
        const amount = parseBigNumber(transfer.value, Number.parseInt(transfer.tokenDecimal))
        beanTx.narration = `get reward ${amount} ${new TokenSymbol(transfer.tokenSymbol)} on 1inch`
      }
    } else if (this.mooniswapTokenMap.has(tx.to)) {
      const token = this.mooniswapTokenMap.get(tx.to)
      const symbol = new TokenSymbol(token!.symbol.split("-").pop() as string)
      const ifc = new Interface(ONE_INCH_LP_ABI)
      const desc = ifc.parseTransaction({ data: tx.input, value: tx.value })
      if (desc.name === "deposit") {
        beanTx.narration = `Add ${symbol} liquidity to 1inch`
      } else if (desc.name === "withdraw") {
        beanTx.narration = `Remove ${symbol} liquidity from 1inch`
      }
    }

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
      const farming = this.farmingInfos.find((farming) =>
        compareAddress(farming.farmingAddress, tokenInfo.address)
      )
      if (farming) {
        const farmingToken = new Contract(
          farming.farmingAddress,
          ONE_INCH_LP_FARM_ABI,
          getDefaultProvider()
        )
        const symbol = new TokenSymbol(await farmingToken.symbol())
        const token0 = await getTokenInfo(farming.token0)
        const token1 = await getTokenInfo(farming.token1)
        const pairToken0 = getPairToken(
          token0,
          Number.parseInt(farming.reserve0),
          new Big(1),
          parseBigNumber(farming.poolTotalSupply)
        )
        const pairToken1 = getPairToken(
          token1,
          Number.parseInt(farming.reserve1),
          new Big(1),
          parseBigNumber(farming.poolTotalSupply)
        )
        const coinInfo0 = await this.coingecko.getCoinInfoByContractAddress(farming.token0)
        const coinInfo1 = await this.coingecko.getCoinInfoByContractAddress(farming.token1)
        const price0 = coinInfo0.market_data.current_price[this.config.baseCurrency.toLowerCase()]
        const price1 = coinInfo1.market_data.current_price[this.config.baseCurrency.toLowerCase()]
        const amount = pairToken0.balance.mul(price0).plus(pairToken1.balance.mul(price1))
        result.prices.push(
          new Price({
            date: DateTime.local(),
            holding: symbol,
            amount,
            symbol: new TokenSymbol(this.config.baseCurrency),
          })
        )
      }
    }

    return Promise.resolve()
  }
}
