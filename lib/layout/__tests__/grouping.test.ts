import { classifyBoundaries, groupPhotos, haversineKm } from "@/lib/layout/grouping"
import type { PhotoSpec, TimeSource } from "@/lib/layout/types"

const at = (day: number, hour: number, minute = 0) => new Date(2026, 0, day, hour, minute).getTime()

/** 서울 시청 근처 기준 좌표에서 동쪽으로 km만큼 */
const SEOUL = { lat: 37.5665, lon: 126.978 }
const east = (km: number) => ({ lat: SEOUL.lat, lon: SEOUL.lon + km / (111.32 * Math.cos((SEOUL.lat * Math.PI) / 180)) })

let counter = 0
function shot(takenAt: number, extra: Partial<PhotoSpec> = {}, timeSource: TimeSource = "exif"): PhotoSpec {
  counter += 1
  return { id: `p${counter}`, width: 4000, height: 3000, takenAt, timeSource, ...extra }
}

const groupSizes = (photos: PhotoSpec[]) => groupPhotos(photos).groups.map((group) => group.photoIds.length)

describe("haversineKm", () => {
  test("measures roughly 1 km per 1 km east", () => {
    expect(haversineKm(SEOUL, east(1))).toBeCloseTo(1, 2)
    expect(haversineKm(SEOUL, SEOUL)).toBe(0)
  })
})

describe("classifyBoundaries", () => {
  test("treats a > 5 km move as hard even within 20 minutes", () => {
    const photos = [shot(at(3, 10, 0), { gps: SEOUL }), shot(at(3, 10, 20), { gps: east(6) })]
    expect(classifyBoundaries(photos)[0]).toMatchObject({ kind: "hard", reason: "distance" })
  })

  test("treats a day change with more than an hour gap as hard", () => {
    const photos = [shot(at(3, 22, 30)), shot(at(4, 9, 0))]
    expect(classifyBoundaries(photos)[0]).toMatchObject({ kind: "hard", reason: "day" })
  })

  test("keeps a 2 a.m. photo on the previous day", () => {
    const photos = [shot(at(3, 23, 30)), shot(at(4, 1, 0))]
    expect(classifyBoundaries(photos)[0].kind).toBe("soft")
  })

  test("marks a 50-minute gap with no GPS as soft and a short gap as none", () => {
    const photos = [shot(at(3, 10, 0)), shot(at(3, 10, 50)), shot(at(3, 11, 0))]
    expect(classifyBoundaries(photos).map((b) => b.kind)).toEqual(["soft", "none"])
  })

  test("does not split a long pause at the same spot", () => {
    const photos = [shot(at(3, 10, 0), { gps: SEOUL }), shot(at(3, 11, 0), { gps: east(0.1) })]
    expect(classifyBoundaries(photos)[0].kind).toBe("none")
  })

  test("uses a location label change as weak evidence (web path)", () => {
    const photos = [shot(at(3, 10, 0), { location: "서울 중구" }), shot(at(3, 10, 30), { location: "서울 마포구" })]
    expect(classifyBoundaries(photos)[0]).toMatchObject({ kind: "soft", reason: "location" })
  })

  test("ignores mtime times but still honors a long GPS jump", () => {
    const photos = [
      shot(at(3, 10, 0), { gps: SEOUL }, "mtime"),
      shot(at(5, 10, 0), { gps: east(1) }, "mtime"),
      shot(at(5, 10, 1), { gps: east(20) }, "mtime"),
    ]
    expect(classifyBoundaries(photos).map((b) => b.kind)).toEqual(["unknown", "hard"])
  })
})

describe("groupPhotos", () => {
  test("splits two outings on the same day", () => {
    const photos = [
      ...[0, 10, 20, 30].map((m) => shot(at(3, 9, m))),
      ...[0, 15, 30].map((m) => shot(at(3, 18, m))),
    ]
    expect(groupSizes(photos)).toEqual([4, 3])
  })

  test("splits on a day change", () => {
    const photos = [shot(at(3, 20)), shot(at(3, 20, 10)), shot(at(4, 9)), shot(at(4, 9, 5))]
    const { groups } = groupPhotos(photos)
    expect(groups.map((g) => g.photoIds.length)).toEqual([2, 2])
    expect(groups[0].boundaryAfter).toBe("hard")
  })

  test("splits on a 5 km drive inside 20 minutes", () => {
    const photos = [
      shot(at(3, 10, 0), { gps: SEOUL }),
      shot(at(3, 10, 5), { gps: east(0.05) }),
      shot(at(3, 10, 25), { gps: east(7) }),
      shot(at(3, 10, 30), { gps: east(7.1) }),
    ]
    const { groups } = groupPhotos(photos)
    expect(groups.map((g) => g.photoIds.length)).toEqual([2, 2])
    expect(groups[1].centroid?.lat).toBeCloseTo(SEOUL.lat, 3)
  })

  test("falls back to chronological mode when most photos only have mtime", () => {
    const photos = [shot(at(3, 9), {}, "mtime"), shot(at(9, 9), {}, "mtime"), shot(at(20, 9), {}, "exif")]
    const result = groupPhotos(photos)
    expect(result.mode).toBe("chronological")
    expect(result.groups).toHaveLength(1)
    expect(result.boundaries.every((b) => b.kind === "unknown")).toBe(true)
  })

  test("groups on time alone when there is no GPS", () => {
    const photos = [shot(at(3, 9)), shot(at(3, 9, 20)), shot(at(3, 13)), shot(at(3, 13, 10))]
    const result = groupPhotos(photos)
    expect(result.mode).toBe("grouped")
    expect(result.groups.map((g) => g.photoIds.length)).toEqual([2, 2])
  })

  test("merges a lone photo into the closer same-day neighbor", () => {
    const photos = [
      shot(at(3, 9, 0)),
      shot(at(3, 9, 10)),
      shot(at(3, 10, 0)), // 50분 뒤 혼자 (soft)
      shot(at(3, 13, 30)), // 3시간 30분 뒤 (hard)
      shot(at(3, 13, 40)),
    ]
    const result = groupPhotos(photos)
    expect(result.groups.map((g) => g.photoIds.length)).toEqual([3, 2])
    expect(result.boundaries[1]).toMatchObject({ kind: "none", merged: true })
  })

  test("keeps a lone photo alone across a day change", () => {
    const photos = [shot(at(3, 9)), shot(at(3, 9, 5)), shot(at(4, 12)), shot(at(5, 12)), shot(at(5, 12, 5))]
    expect(groupSizes(photos)).toEqual([2, 1, 2])
  })

  test("reports start, end and the most common location", () => {
    const photos = [
      shot(at(3, 9), { location: "제주 서귀포" }),
      shot(at(3, 9, 5), { location: "제주 서귀포" }),
      shot(at(3, 9, 10), { location: "제주 서귀포" }),
    ]
    const [group] = groupPhotos(photos).groups
    expect(group).toMatchObject({ id: "g1", start: at(3, 9), end: at(3, 9, 10), location: "제주 서귀포" })
  })
})
