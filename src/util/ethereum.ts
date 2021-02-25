import { Contract, getDefaultProvider } from "ethers"
import { TokenSymbol } from "../beancount/token_symbol"
import { ERC20_ABI } from "../middleware/erc20_abi"
import { Erc20Transfer, InternalTx, NormalTx } from "../service/etherscan_model"
import { compareAddress, TokenInfo } from "./transform"

export const ETH_DECIMALS = 18
export const ETH_SYMBOL = new TokenSymbol("ETH")

export interface TxCombined {
  hash: string
  timeStamp: number
  normalTx?: NormalTx
  internalTxs: InternalTx[]
  erc20Transfers: Erc20Transfer[]
}

export function createCombinedTx(hash: string): TxCombined {
  return {
    hash,
    timeStamp: 0,
    internalTxs: [],
    erc20Transfers: [],
  }
}

export function updateCombinedTxs(
  combinedTxs: TxCombined[],
  hash: string,
  normalTx?: NormalTx,
  internalTx?: InternalTx,
  erc20Transfer?: Erc20Transfer
) {
  let combined = combinedTxs.find((combined) => hash === combined.hash)
  if (!combined) {
    combined = createCombinedTx(hash)
    combinedTxs.push(combined)
  }

  if (normalTx) {
    combined.timeStamp = Number.parseInt(normalTx.timeStamp)
    combined.normalTx = normalTx
  }
  if (internalTx) {
    combined.timeStamp = Number.parseInt(internalTx.timeStamp)
    combined.internalTxs.push(internalTx)
  }
  if (erc20Transfer) {
    combined.timeStamp = Number.parseInt(erc20Transfer.timeStamp)
    combined.erc20Transfers.push(erc20Transfer)
  }
}

export function combineTxs(
  normalTxs: NormalTx[],
  internalTxs: InternalTx[],
  erc20Transfers: Erc20Transfer[]
): TxCombined[] {
  const combinedTxs: TxCombined[] = []

  normalTxs.forEach((normalTx) => {
    updateCombinedTxs(combinedTxs, normalTx.hash, normalTx)
  })

  internalTxs.forEach((internalTx) => {
    updateCombinedTxs(combinedTxs, internalTx.hash, undefined, internalTx)
  })

  erc20Transfers.forEach((transfer) => {
    updateCombinedTxs(combinedTxs, transfer.hash, undefined, undefined, transfer)
  })

  return combinedTxs.sort((txA, txB) => txA.timeStamp - txB.timeStamp)
}

export function getShortAddress(address: string): string {
  return `${address.substr(0, 6)}...${address.slice(-4)}`
}

export async function getTokenInfo(
  address: string,
  provider = getDefaultProvider()
): Promise<TokenInfo> {
  const saiAddr = "0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359"
  const token = new Contract(address, ERC20_ABI, provider)
  const symbol = compareAddress(address, saiAddr) ? "SAI" : await token.symbol()
  const decimal: number = await token.decimals()
  return {
    symbol: new TokenSymbol(symbol),
    decimal,
    address,
  }
}
