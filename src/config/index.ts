export interface EtherscanConfig {
  apiKey: string
}

export interface Account {
  name: string
  address: string
}

export interface Config {
  accounts: Account[]
  baseCurrency: string
  defaultExpense: string
  defaultIncome: string
  txFeeAccount: string
  pnlAccount: string
  etherscan: EtherscanConfig
  fromBlock: number
}
