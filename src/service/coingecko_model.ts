interface CurrencyValue<T> {
  [currency: string]: T
  aed: T
  ars: T
  aud: T
  bch: T
  bdt: T
  bhd: T
  bmd: T
  bnb: T
  brl: T
  btc: T
  cad: T
  chf: T
  clp: T
  cny: T
  czk: T
  dkk: T
  dot: T
  eos: T
  eth: T
  eur: T
  gbp: T
  hkd: T
  huf: T
  idr: T
  ils: T
  inr: T
  jpy: T
  krw: T
  kwd: T
  lkr: T
  ltc: T
  mmk: T
  mxn: T
  myr: T
  ngn: T
  nok: T
  nzd: T
  php: T
  pkr: T
  pln: T
  rub: T
  sar: T
  sek: T
  sgd: T
  thb: T
  try: T
  twd: T
  uah: T
  usd: T
  vef: T
  vnd: T
  xag: T
  xau: T
  xdr: T
  xlm: T
  xrp: T
  yfi: T
  zar: T
  bits: T
  link: T
  sats: T
}

type CurrentPrice = CurrencyValue<number>

interface MarketData {
  current_price: CurrentPrice
}

export interface GetCoinInfoResponse {
  id: string
  symbol: string
  name: string
  contract_address: string
  market_data: MarketData
}
