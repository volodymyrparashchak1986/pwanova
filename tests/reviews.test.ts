import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { pickReviewHighlights } from "../src/lib/reviews"

const r = (id: string, appId: string, helpfulCount: number, daysAgo: number, body = "Solid app.") => ({
  id, appId, helpfulCount, body, createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
})

describe("pickReviewHighlights", () => {
  it("caps per app, most helpful first, then newest", () => {
    const picked = pickReviewHighlights([r("a1", "A", 1, 10), r("a2", "A", 5, 30), r("a3", "A", 5, 2), r("a4", "A", 0, 0)], ["A"], 3)
    assert.deepEqual(picked.get("A")!.map((x) => x.id), ["a3", "a2", "a1"])
  })
  it("keeps the caller's app order and returns empty buckets for apps without reviews", () => {
    const picked = pickReviewHighlights([r("b1", "B", 0, 1), r("c1", "C", 9, 1)], ["C", "A", "B"], 3)
    assert.deepEqual([...picked.keys()], ["C", "A", "B"])
    assert.equal(picked.get("A")!.length, 0)
    assert.equal(picked.get("B")![0].id, "b1")
  })
  it("ignores reviews of other apps and empty bodies", () => {
    const picked = pickReviewHighlights([r("x1", "X", 50, 1), r("a1", "A", 1, 1, "   ")], ["A"], 3)
    assert.equal(picked.get("A")!.length, 0)
    assert.equal(picked.has("X"), false)
  })
  it("never fabricates: zero reviews in gives zero reviews out", () => {
    const picked = pickReviewHighlights([], ["A", "B"], 3)
    assert.deepEqual([...picked.values()].map((v) => v.length), [0, 0])
  })
})
