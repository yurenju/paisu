import { joinParameters } from "../util/parameter";
import fetch from 'node-fetch'

interface BaseTxsResult {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  contractAddress: string;
  value: string;
  gas: string;
}

interface GetErc20TransfersResult extends BaseTxsResult {
  nonce: string;
  blockHash: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  confirmations: string;
}

interface GetInternalTxsResult extends BaseTxsResult {
  input: string;
  type: string;
  gasUsed: string;
  traceId: string;
  isError: string;
  errCode: string;
}

interface GetTxsResult extends BaseTxsResult {
  nonce: string;
  blockHash: string;
  transactionIndex: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  confirmations: string;
}

enum Status {
  Failure = "0",
  Success = "1",
}

interface Response<T> {
  status: Status;
  message: string;
  result: T[] | string;
}

type GetTxsResponse = Response<GetTxsResult>;
type GetInternalTxsResponse = Response<GetInternalTxsResult>;
type GetErc20TransfersResponse = Response<GetErc20TransfersResult>;

enum Sort {
  Asc = "asc",
  Desc = "desc",
}

enum Module {
  Account = "account",
}

enum Action {
  TxList = "txlist",
  TxListInternal = "txlistinternal",
  TokenTx = "tokentx",
}

interface Parameters {
  [key: string]: string;
  module: Module;
  action: Action;
  address: string;
  sort: Sort;
  apiKey: string;
}

const DEFAULT_ETHERSCAN_BASE_URL = "https://api.etherscan.io/api";

export class Etherscan {
  readonly apiKey: string;
  readonly rateLimit: number;
  readonly baseUrl: string;

  constructor(
    apiKey: string,
    rateLimit = 5,
    baseUrl = DEFAULT_ETHERSCAN_BASE_URL,
  ) {
    this.apiKey = apiKey;
    this.rateLimit = rateLimit;
    this.baseUrl = baseUrl;
  }

  getTransactions(
    address: string,
    sort = Sort.Asc,
  ): Promise<GetTxsResponse> {
    return this.getGenericTransactions(
      address,
      sort,
      Module.Account,
      Action.TxList,
    );
  }

  getInternalTransactions(
    address: string,
    sort = Sort.Asc,
  ): Promise<GetInternalTxsResponse> {
    return this.getGenericTransactions(
      address,
      sort,
      Module.Account,
      Action.TxListInternal,
    );
  }

  getErc20Transfers(
    address: string,
    sort = Sort.Asc,
  ): Promise<GetErc20TransfersResponse> {
    return this.getGenericTransactions(
      address,
      sort,
      Module.Account,
      Action.TokenTx,
    );
  }

  getGenericTransactions(
    address: string,
    sort: Sort,
    module: Module,
    action: Action,
  ) {
    const { apiKey } = this;
    const parameters: Parameters = {
      module,
      action,
      address,
      sort,
      apiKey,
    };
    const query = `${this.baseUrl}?${joinParameters(parameters)}`;
    return fetch(query).then((res) => res.json());
  }
}
