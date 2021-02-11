import yaml from "js-yaml"
import { Config } from "./config"
import { Etherscan } from "./service/etherscan"
import { readFileSync } from "fs"

async function main() {
  const configFile = readFileSync("./sample/config.yaml", { encoding: "utf-8" })
  const content = yaml.load(configFile) as Config

  const etherscan = new Etherscan(content.etherscan.apiKey)
  const res = await etherscan.getInternalTransactions(content.addresses[0])
  console.log(res)
}

main()
