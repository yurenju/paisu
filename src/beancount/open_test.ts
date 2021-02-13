import { expect } from "chai"
import { DateTime } from "luxon"
import { BookingMethod, Open } from "."

describe("Open", () => {
  const options = {
    date: DateTime.fromISO("2020-03-11"),
    symbol: "TWD",
    account: "Asset:Bank:Detroit",
  }

  it("constructor", () => {
    const open = new Open(options)
    expect(open.date.toISODate()).eq("2020-03-11")
    expect(open.symbol).eq("TWD")
    expect(open.account).eq("Asset:Bank:Detroit")
  })

  it("toString()", () => {
    const open = new Open(options)
    expect(open.toString()).eq("2020-03-11 open Asset:Bank:Detroit TWD")
  })

  it("toString() with booking method", () => {
    const bookingOptions = { ...options, bookingMethod: BookingMethod.LIFO }
    const open = new Open(bookingOptions)
    expect(open.toString()).eq(`2020-03-11 open Asset:Bank:Detroit TWD "LIFO"`)
  })
})
