// 매니페스트 버전 호환 — scan이 가장 느린 단계라 예전 매니페스트도 다시 scan 없이 쓴다
import { deriveTimeSource } from "@/cli/ingest/metadata"
import { MANIFEST_VERSION, SUPPORTED_MANIFEST_VERSIONS, type ScanManifest } from "@/cli/types"

/** 읽은 매니페스트를 검증하고 현재 버전 형태로 올린다 */
export function upgradeManifest(manifest: ScanManifest): ScanManifest {
  if (!SUPPORTED_MANIFEST_VERSIONS.includes(manifest.version)) {
    throw new Error(
      `지원하지 않는 매니페스트 버전입니다 (지원 ${SUPPORTED_MANIFEST_VERSIONS.join(", ")}, 실제 ${manifest.version}). 다시 scan하세요`,
    )
  }
  if (!Array.isArray(manifest.photos)) {
    throw new Error("매니페스트에 photos 배열이 없습니다")
  }

  // v1에는 timeSource가 없다 → unknown으로 두고 파일명/GPS로 다시 추정
  const photos = manifest.photos.map((photo) => {
    if (photo.timeSource) return photo
    const derived = deriveTimeSource(photo)
    return {
      ...photo,
      takenAt: derived.takenAt,
      date: derived.date ?? photo.date,
      timeSource: derived.timeSource,
    }
  })

  return { ...manifest, version: MANIFEST_VERSION, photos }
}
