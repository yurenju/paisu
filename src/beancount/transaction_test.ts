import Big from "big.js"
import { expect } from "chai"
import { DateTime } from "luxon"
import { Posting } from "./posting"
import { TokenSymbol } from "./token_symbol"
import { Transaction } from "./transaction"

describe("Transaction", () => {
  it("with base transaction", () => {
    const json = {
      date: DateTime.fromISO("2012-02-01"),
      narration: "description",
    }
    const tx = new Transaction(json)
    expect(tx.toString()).eq(`2012-02-01 * "description"`)
  })

  it("with multiple postings", () => {
    const json = {
      date: DateTime.fromISO("2012-02-01"),
      narration: "description",
      postings: [
        new Posting({
          account: "TestAccount1",
          amount: new Big("30.0"),
          symbol: new TokenSymbol("TWD"),
        }),
        new Posting({
          account: "TestAccount2",
          amount: new Big("-30.0"),
          symbol: new TokenSymbol("TWD"),
        }),
      ],
    }
    const tx = new Transaction(json)
    const expected = [
      `2012-02-01 * "description"`,
      "  TestAccount1 30 TWD",
      "  TestAccount2 -30 TWD",
    ]
    expect(tx.toString()).eq(expected.join("\n"))
  })
})
