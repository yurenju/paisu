import yaml from "js-yaml"
import { Config } from "./config"
import { Etherscan } from "./service/etherscan"
import { readFileSync } from "fs"
import { combineTxs } from "./util/tx"

async function main() {
  const configFile = readFileSync("./sample/config.yaml", { encoding: "utf-8" })
  const content = yaml.load(configFile) as Config

  const etherscan = new Etherscan(content.etherscan.apiKey)
  const txs = await etherscan.getNormalTransactions(content.addresses[0])
  const erc20Transfers = await etherscan.getErc20Transfers(content.addresses[0])
  const internalTxs = await etherscan.getInternalTransactions(content.addresses[0])
  const combinedTxs = combineTxs(txs, internalTxs, erc20Transfers)
  console.log(combinedTxs)
}

main()
