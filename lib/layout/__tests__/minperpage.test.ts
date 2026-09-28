import { contentBox } from "@/lib/layout/page-layout"
import { paginate } from "@/lib/layout/paginate"
import type { PhotoSpec } from "@/lib/layout/types"

const box = contentBox("portrait")
const photo = (id: string, width = 4000, height = 3000): PhotoSpec => ({ id, width, height })
const photos = (count: number, prefix = "p") => Array.from({ length: count }, (_, i) => photo(`${prefix}${i}`))
const boundaries = (n: number) => Array.from({ length: n }, (_, i) => ({ index: i, kind: "none" as const, reason: "test" }))
const sizes = (plans: ReturnType<typeof paginate>) => plans.map((plan) => plan.photos.length)

describe("paginate minPerPage", () => {
  test("페이지당 최소 개수를 지킨다 (마지막 페이지 제외)", () => {
    const plans = paginate(photos(10), boundaries(9), {
      box,
      orientation: "portrait",
      density: "medium",
      layoutSource: "procedural",
      minPerPage: 4,
    })
    const counts = sizes(plans)
    // 중간 페이지는 모두 >= 4
    for (let i = 0; i < counts.length - 1; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(4)
    }
    // 사진 전부 1회씩, 순서 유지
    expect(plans.flatMap((p) => p.photos.map((x) => x.id))).toEqual(photos(10).map((x) => x.id))
  })
})