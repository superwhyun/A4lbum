import type { Boundary, BoundaryKind } from "@/lib/layout/grouping"
import { contentBox } from "@/lib/layout/page-layout"
import { paginate } from "@/lib/layout/paginate"
import type { PhotoSpec } from "@/lib/layout/types"

const box = contentBox("portrait")

const photo = (id: string, width = 4000, height = 3000): PhotoSpec => ({ id, width, height })
const photos = (count: number, prefix = "p") => Array.from({ length: count }, (_, i) => photo(`${prefix}${i}`))
const boundaries = (kinds: BoundaryKind[]): Boundary[] => kinds.map((kind, index) => ({ index, kind, reason: "test" }))
const sizes = (plans: ReturnType<typeof paginate>) => plans.map((plan) => plan.photos.length)

describe("paginate", () => {
  test("splits one 7-photo group into 4 + 3 on medium density", () => {
    const plans = paginate(photos(7), boundaries(Array(6).fill("none")), {
      box,
      orientation: "portrait",
      density: "medium",
      layoutSource: "procedural",
    })
    expect([...sizes(plans)].sort()).toEqual([3, 4])
  })

  test("lets two same-day singletons share a page across a soft boundary", () => {
    const plans = paginate(photos(2), boundaries(["soft"]), {
      box,
      orientation: "portrait",
      density: "medium",
      layoutSource: "procedural",
    })
    expect(sizes(plans)).toEqual([2])
  })

  test("never crosses a hard boundary between large groups", () => {
    const list = [...photos(5, "a"), ...photos(4, "b"), ...photos(6, "c")]
    const kinds: BoundaryKind[] = list.slice(1).map((_, i) => (i === 4 || i === 8 ? "hard" : "none"))
    for (const density of ["sparse", "medium", "dense"] as const) {
      const plans = paginate(list, boundaries(kinds), { box, orientation: "portrait", density, layoutSource: "procedural" })
      for (const plan of plans) {
        expect(new Set(plan.photos.map((p) => p.id[0])).size).toBe(1)
      }
    }
  })

  test("keeps every photo exactly once and in order", () => {
    const list = photos(23)
    const plans = paginate(list, boundaries(Array(22).fill("none")), {
      box,
      orientation: "portrait",
      density: "dense",
      layoutSource: "both",
    })
    expect(plans.flatMap((plan) => plan.photos.map((p) => p.id))).toEqual(list.map((p) => p.id))
    expect(plans.every((plan) => plan.page.cells.map((c) => c.photo.id).join() === plan.photos.map((p) => p.id).join())).toBe(true)
  })

  test("respects the per-page maximum", () => {
    const plans = paginate(photos(20), boundaries(Array(19).fill("none")), {
      box,
      orientation: "portrait",
      density: "sparse",
      layoutSource: "procedural",
    })
    expect(Math.max(...sizes(plans))).toBeLessThanOrEqual(3)
  })

  test("is deterministic without an rng and varies with one", () => {
    const list = photos(12).map((p, i) => (i % 3 === 0 ? { ...p, width: 3000, height: 4000 } : p))
    const run = (rng?: () => number) =>
      JSON.stringify(
        paginate(list, boundaries(Array(11).fill("none")), {
          box,
          orientation: "portrait",
          density: "medium",
          layoutSource: "procedural",
          rng,
          densityJitter: 1,
        }).map((plan) => [plan.start, plan.end, plan.page.label]),
      )

    expect(run()).toBe(run())
    let seed = 1
    const shapes = new Set(
      Array.from({ length: 8 }, () => {
        seed += 1
        let state = seed
        return run(() => {
          state = (state * 48271) % 2147483647
          return state / 2147483647
        })
      }),
    )
    expect(shapes.size).toBeGreaterThan(1)
  })
})
