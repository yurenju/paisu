export class TokenSymbol {
  readonly tokenSymbol: string

  constructor(symbol: string) {
    this.tokenSymbol = symbol
      .toUpperCase()
      .replace(/[$+]/g, "")
      .replace(/^[0-9]/g, "")
  }

  toString(): string {
    return this.tokenSymbol
  }
}
