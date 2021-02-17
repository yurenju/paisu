import Big from "big.js"
import { expect } from "chai"
import { Posting, PriceType } from "./posting"
import { TokenSymbol } from "./token_symbol"

describe("Posting", () => {
  it("with account & amount", () => {
    const json = {
      account: "TestAccount",
      amount: new Big("30.0"),
      symbol: new TokenSymbol("TWD"),
    }
    const posting = new Posting(json)
    expect(posting.toString()).to.eq("  TestAccount 30 TWD")
  })

  it("without amount", () => {
    const json = {
      account: "TestAccount",
    }
    const posting = new Posting(json)
    expect(posting.toString()).eq("  TestAccount")
  })

  it("with cost", () => {
    const json = {
      account: "TestAccount",
      amount: new Big("30.0"),
      symbol: new TokenSymbol("TWD"),
      cost: {
        amount: new Big("2.0"),
        symbol: new TokenSymbol("JPY"),
      },
    }
    const posting = new Posting(json)
    expect(posting.toString()).to.eq("  TestAccount 30 TWD {2 JPY}")
  })

  it("with unit price", () => {
    const json = {
      account: "TestAccount",
      amount: new Big("30.0"),
      symbol: new TokenSymbol("TWD"),
      price: {
        type: PriceType.Unit,
        amount: new Big("2.0"),
        symbol: new TokenSymbol("JPY"),
      },
    }
    const posting = new Posting(json)
    expect(posting.toString()).to.eq("  TestAccount 30 TWD @ 2 JPY")
  })

  it("with total price", () => {
    const json = {
      account: "TestAccount",
      amount: new Big("30.0"),
      symbol: new TokenSymbol("TWD"),
      price: {
        type: PriceType.Total,
        amount: new Big("2.0"),
        symbol: new TokenSymbol("JPY"),
      },
    }
    const posting = new Posting(json)
    expect(posting.toString()).to.eq("  TestAccount 30 TWD @@ 2 JPY")
  })

  it("with metadata", () => {
    const json = {
      account: "TestAccount",
      amount: new Big("30.0"),
      symbol: new TokenSymbol("TWD"),
      metadata: {
        tx: "tx-hash",
        key2: "value2",
      },
    }
    const posting = new Posting(json)
    const expected = ["  TestAccount 30 TWD", `    tx: "tx-hash"`, `    key2: "value2"`]
    expect(posting.toString()).to.eq(expected.join("\n"))
  })

  it("with all fields", () => {
    const json = {
      account: "TestAccount",
      amount: new Big("30.0"),
      symbol: new TokenSymbol("TWD"),
      cost: {
        amount: new Big("5.0"),
        symbol: new TokenSymbol("JPY"),
        ambiguous: false,
      },
      price: {
        type: PriceType.Total,
        amount: new Big("20.1"),
        symbol: new TokenSymbol("EUR"),
      },
      metadata: {
        tx: "tx-hash",
        key2: "value2",
      },
    }
    const posting = new Posting(json)
    const expected = [
      "  TestAccount 30 TWD {5 JPY} @@ 20.1 EUR",
      `    tx: "tx-hash"`,
      `    key2: "value2"`,
    ]
    expect(posting.toString()).to.eq(expected.join("\n"))
  })
})
