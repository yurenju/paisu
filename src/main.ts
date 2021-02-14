import yaml from "js-yaml"
import { Config } from "./config"
import { Etherscan } from "./service/etherscan"
import { readFileSync } from "fs"
import { combineTxs } from "./util/ethereum"
import { roastBean } from "./util/transform"

async function main() {
  const configFile = readFileSync("./sample/config.yaml", { encoding: "utf-8" })
  const config = yaml.load(configFile) as Config

  const etherscan = new Etherscan(config.etherscan.apiKey)
  const account = config.accounts[0]
  const txs = await etherscan.getNormalTransactions(account.address)
  const erc20Transfers = await etherscan.getErc20Transfers(account.address)
  const internalTxs = await etherscan.getInternalTransactions(account.address)
  const combinedTxs = combineTxs(txs, internalTxs, erc20Transfers)
  const beanTxs = combinedTxs.map((tx) => roastBean(tx, config))
  console.log(beanTxs.map((tx) => tx.toString()).join("\n\n"))
}

main()
