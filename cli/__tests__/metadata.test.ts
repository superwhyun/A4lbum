import { upgradeManifest } from "@/cli/ingest/manifest"
import { deriveTimeSource, parseFilenameTimestamp } from "@/cli/ingest/metadata"
import type { ScanManifest, ScannedPhoto } from "@/cli/types"

const local = (y: number, mo: number, d: number, h: number, mi: number, s = 0) => new Date(y, mo - 1, d, h, mi, s)

describe("parseFilenameTimestamp", () => {
  test.each([
    ["IMG_20240512_143012.jpg", local(2024, 5, 12, 14, 30, 12)],
    ["PXL_20240512_143012345.jpg", local(2024, 5, 12, 14, 30, 12)],
    ["KakaoTalk_20240512_143012123_01.jpg", local(2024, 5, 12, 14, 30, 12)],
    ["20240512_143012.jpg", local(2024, 5, 12, 14, 30, 12)],
    ["Screenshot_2024-05-12-14-30-12.png", local(2024, 5, 12, 14, 30, 12)],
    ["photo_2024-05-12 14.30.12.jpeg", local(2024, 5, 12, 14, 30, 12)],
    ["IMG_20240512_1430.jpg", local(2024, 5, 12, 14, 30)],
  ])("parses %s", (fileName, expected) => {
    expect(parseFilenameTimestamp(fileName)?.getTime()).toBe(expected.getTime())
  })

  test.each([
    "IMG_1234.JPG",
    "20240512.jpg",
    "IMG_20241312_143012.jpg", // 13월
    "IMG_20240230_143012.jpg", // 2월 30일
    "IMG_20240512_256012.jpg", // 25시
    "vacation.png",
  ])("rejects %s", (fileName) => {
    expect(parseFilenameTimestamp(fileName)).toBeUndefined()
  })
})

describe("deriveTimeSource (v1 manifests)", () => {
  test("trusts a recorded time that is not later than the filename time", () => {
    const takenAt = local(2024, 5, 12, 14, 30, 0).toISOString()
    expect(deriveTimeSource({ fileName: "IMG_20240512_143012.jpg", takenAt }).timeSource).toBe("exif")
  })

  test("replaces an mtime-looking time with the filename time", () => {
    const synced = local(2026, 1, 3, 9, 0).toISOString()
    const derived = deriveTimeSource({ fileName: "IMG_20240512_143012.jpg", takenAt: synced })
    expect(derived.timeSource).toBe("filename")
    expect(derived.takenAt).toBe(local(2024, 5, 12, 14, 30, 12).toISOString())
    expect(derived.date).toBe("2024.05.12")
  })

  test("treats a photo with GPS as having EXIF", () => {
    const takenAt = local(2024, 5, 12, 14, 30).toISOString()
    expect(deriveTimeSource({ fileName: "a.jpg", takenAt, gps: { lat: 37, lon: 127 } }).timeSource).toBe("exif")
  })

  test("marks the rest unknown", () => {
    expect(deriveTimeSource({ fileName: "a.jpg", takenAt: new Date().toISOString() }).timeSource).toBe("unknown")
  })
})

describe("upgradeManifest", () => {
  const photo = (fileName: string, extra: Partial<ScannedPhoto> = {}): ScannedPhoto => ({
    id: fileName,
    path: `/x/${fileName}`,
    fileName,
    width: 100,
    height: 100,
    bytes: 1,
    takenAt: local(2026, 1, 3, 9, 0).toISOString(),
    hash: "0",
    quality: { sharpness: 1, exposure: 1, contrast: 1, entropy: 1, score: 1 },
    ...extra,
  })

  test("accepts a v1 manifest and fills timeSource", () => {
    const v1: ScanManifest = {
      version: 1,
      sourceDir: "/x",
      scannedAt: "",
      photos: [photo("IMG_20240512_143012.jpg"), photo("a.jpg")],
    }
    const upgraded = upgradeManifest(v1)
    expect(upgraded.version).toBe(2)
    expect(upgraded.photos.map((p) => p.timeSource)).toEqual(["filename", "unknown"])
  })

  test("keeps v2 photos as they are", () => {
    const v2: ScanManifest = { version: 2, sourceDir: "/x", scannedAt: "", photos: [photo("a.jpg", { timeSource: "mtime" })] }
    expect(upgradeManifest(v2).photos[0].timeSource).toBe("mtime")
  })

  test("rejects unknown versions", () => {
    expect(() => upgradeManifest({ version: 99, sourceDir: "", scannedAt: "", photos: [] })).toThrow("매니페스트 버전")
  })
})
