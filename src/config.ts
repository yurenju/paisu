export interface EtherscanConfig {
  apiKey: string
}

interface Account {
  name: string
  address: string
}

export interface Config {
  accounts: Account[]
  baseCurrency: string
  defaultExpense: string
  defaultIncome: string
  etherscan: EtherscanConfig
}
