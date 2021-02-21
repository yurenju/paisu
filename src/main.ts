import { readFileSync, writeFile } from "fs"
import yaml from "js-yaml"
import { DateTime } from "luxon"
import { promisify } from "util"
import { Config } from "./config"
import { CoinGecko } from "./service/coingecko"
import { Etherscan } from "./service/etherscan"
import { Erc20Transfer, InternalTx, NormalTx } from "./service/etherscan_model"
import { Transformer } from "./transformer"
import { combineTxs } from "./util/ethereum"

async function main() {
  console.log(process.argv)
  const configFile = readFileSync(process.argv[2], { encoding: "utf-8" })
  const config = yaml.load(configFile) as Config

  const etherscan = new Etherscan(config.etherscan.apiKey)
  const coingecko = new CoinGecko()
  const transformer = new Transformer(coingecko, etherscan, config)
  console.log("getting transactions from etherscan...")
  const normalTxs: NormalTx[] = []
  const erc20Transfers: Erc20Transfer[] = []
  const internalTxs: InternalTx[] = []

  for (let i = 0; i < config.accounts.length; i++) {
    const account = config.accounts[i]
    normalTxs.push(...(await etherscan.getNormalTransactions(account.address, config.startBlock)))
    erc20Transfers.push(...(await etherscan.getErc20Transfers(account.address, config.startBlock)))
    internalTxs.push(
      ...(await etherscan.getInternalTransactions(account.address, config.startBlock))
    )
  }

  const combinedTxs = combineTxs(normalTxs, internalTxs, erc20Transfers)
  const result = await transformer.roastBeans(
    DateTime.fromISO("2018-01-01"),
    combinedTxs,
    normalTxs,
    internalTxs,
    erc20Transfers
  )

  let output: string[] = [
    result.options.map((option) => option.toString()).join("\n"),
    result.opens.map((open) => open.toString()).join("\n"),
    result.transactions.map((tx) => tx.toString()).join("\n\n"),
    result.balances.map((balance) => balance.toString()).join("\n"),
    result.prices.map((price) => price.toString()).join("\n"),
  ]

  const write = promisify(writeFile)
  await write("crypto.bean", output.join("\n\n"), "utf8")
}

main()
