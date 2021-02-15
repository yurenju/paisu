export interface BaseTx {
  blockNumber: string
  timeStamp: string
  hash: string
  from: string
  to: string
  contractAddress: string
  value: string
  gas: string
  gasUsed: string
}

export interface Erc20Transfer extends BaseTx {
  nonce: string
  blockHash: string
  tokenName: string
  tokenSymbol: string
  tokenDecimal: string
  transactionIndex: string
  gasPrice: string
  cumulativeGasUsed: string
  input: string
  confirmations: string
}

export interface InternalTx extends BaseTx {
  input: string
  type: string
  traceId: string
  isError: string
  errCode: string
}

export interface NormalTx extends BaseTx {
  nonce: string
  blockHash: string
  transactionIndex: string
  gasPrice: string
  isError: string
  txreceipt_status: string
  input: string
  cumulativeGasUsed: string
  confirmations: string
}
export enum Status {
  Failure = "0",
  Success = "1",
}
export interface Response<T> {
  status: Status
  message: string
  result: T | string
}
export enum Sort {
  Asc = "asc",
  Desc = "desc",
}
export enum Module {
  Account = "account",
}
export enum Action {
  TxList = "txlist",
  TxListInternal = "txlistinternal",
  TokenTx = "tokentx",
  TokenBalance = "tokenbalance",
}
