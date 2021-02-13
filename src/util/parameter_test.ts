import { expect } from "chai"
import { joinParameters } from "./parameter"

describe("joinParameters", () => {
  it("basic concat", () => {
    const params = {
      a: "1",
      b: "2",
    }
    const actual = joinParameters(params)
    expect(actual).to.eq("a=1&b=2")
  })
})
