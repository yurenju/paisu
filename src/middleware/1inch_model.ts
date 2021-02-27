export interface OneInchTokenInfo {
  symbol: string
  name: string
  address: string
  decimals: number
  logoURI: string
}

export interface OneInchFarmingInfo {
  poolAddress: string
  farmingAddress: string
  token0: string
  token1: string
  totalStaked: string
  rewardRate: string
  reserve0: string
  reserve1: string
  poolTotalSupply: string
  slippageFee: string
  fee: string
  decayPeriod: string
  poolBalance: string
  poolStaked: string
  allowance: string
  earnedAmount: string
}
