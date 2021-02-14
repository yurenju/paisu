import yaml from "js-yaml"
import { Config } from "./config"
import { Etherscan } from "./service/etherscan"
import { readFileSync } from "fs"
import { combineTxs } from "./util/tx"

async function main() {
  const configFile = readFileSync("./sample/config.yaml", { encoding: "utf-8" })
  const content = yaml.load(configFile) as Config

  const etherscan = new Etherscan(content.etherscan.apiKey)
  const account = content.accounts[0]
  const txs = await etherscan.getNormalTransactions(account.address)
  const erc20Transfers = await etherscan.getErc20Transfers(account.address)
  const internalTxs = await etherscan.getInternalTransactions(account.address)
  const combinedTxs = combineTxs(txs, internalTxs, erc20Transfers)
  console.log(combinedTxs)
}

main()
