import { readFileSync, writeFile } from "fs"
import yaml from "js-yaml"
import { DateTime } from "luxon"
import { promisify } from "util"
import { Directive } from "./beancount"
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
  const account = config.accounts[0]
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
  const setupBeans: Directive[] = []
  const txBeans: Directive[] = []
  setupBeans.push(...transformer.initBeans(DateTime.fromISO("2018-01-01")))

  for (let i = 0; i < combinedTxs.length; i++) {
    const combinedTx = combinedTxs[i]
    console.log(`processing ${combinedTx.hash} - ${i + 1}/${combinedTxs.length}...`)
    const bean = await transformer.getTransaction(combinedTx)
    txBeans.push(bean)
  }

  const statusBeans = await transformer.getCurrentStatus(erc20Transfers)

  const result = [setupBeans, txBeans, statusBeans]
    .map((beans) => beans.map((bean) => bean.toString()).join("\n"))
    .join("\n\n")
  const write = promisify(writeFile)
  await write("crypto.bean", result, "utf8")
}

main()
