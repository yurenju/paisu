export interface EtherscanConfig {
  apiKey: string
}

export interface Config {
  addresses: string[]
  baseCurrency: string
  etherscan: EtherscanConfig
}
