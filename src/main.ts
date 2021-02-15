import yaml from "js-yaml"
import { Config } from "./config"
import { Etherscan } from "./service/etherscan"
import { readFileSync, writeFile } from "fs"
import { combineTxs } from "./util/ethereum"
import { Transformer } from "./util/transform"
import { promisify } from "util"
import { CoinGecko } from "./service/coingecko"
import { DateTime } from "luxon"
import { Transaction } from "./beancount"

async function main() {
  const configFile = readFileSync("./sample/config.yaml", { encoding: "utf-8" })
  const config = yaml.load(configFile) as Config

  const etherscan = new Etherscan(config.etherscan.apiKey)
  const coingecko = new CoinGecko()
  const transformer = new Transformer(coingecko, config)
  const account = config.accounts[0]
  console.log("getting transactions from etherscan...")
  const txs = await etherscan.getNormalTransactions(account.address)
  const erc20Transfers = await etherscan.getErc20Transfers(account.address)
  const internalTxs = await etherscan.getInternalTransactions(account.address)
  const combinedTxs = combineTxs(txs, internalTxs, erc20Transfers)
  const initBeans = transformer.initBeans(DateTime.fromISO("2018-01-01"))
  const beanTxs: Transaction[] = []
  for (let i = 0; i < combinedTxs.length; i++) {
    const combinedTx = combinedTxs[i]
    console.log(`processing ${i + 1}/${combinedTxs.length}...`)
    const bean = await transformer.roastBean(combinedTx)
    beanTxs.push(bean)
  }
  const result = [...initBeans, ...beanTxs].map((tx) => tx.toString()).join("\n\n")
  const write = promisify(writeFile)
  await write("crypto.bean", result, "utf8")
}

main()
