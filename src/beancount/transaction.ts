import { DateTime } from "luxon"
import { copyValues } from "../util/misc"
import { DEFAULT_DATE, Directive } from "./directive"
import { Posting } from "./posting"

enum TxFlag {
  Completed = "*",
  Incomplete = "!",
}

export class Transaction extends Directive {
  date: DateTime = DEFAULT_DATE
  flag: TxFlag = TxFlag.Completed
  payee: string = ""
  narration: string = ""
  metadata: Record<string, string> = {}
  postings: Posting[] = []

  constructor(tx?: Partial<Transaction>) {
    super()
    if (tx) {
      copyValues(tx, this)
    }
  }

  toString() {
    const { date, flag, payee, narration, postings, metadata } = this
    const lines = []

    let major = `${date.toISODate()} ${flag}`
    if (payee) {
      major += ` "${payee}"`
    }
    if (narration) {
      major += ` "${narration}"`
    }
    lines.push(major)

    if (Object.keys(metadata).length > 0) {
      lines.push(...Object.entries(metadata).map(([key, value]) => `  ${key}: "${value}"`))
    }

    if (postings.length > 0) {
      lines.push(...postings.map((posting) => posting.toString()))
    }

    return lines.join("\n") + "\n"
  }
}
