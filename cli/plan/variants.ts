// 같은 사진 묶음으로 서로 다른 랜덤 레이아웃의 후보 앨범을 여러 개 만든다
import { buildAlbum, createRng, type PhotoSpec } from "@/lib/album-generator"
import { scoreAlbum, type ScoringPhoto } from "@/cli/plan/score"
import type { SelectedPhoto } from "@/cli/select/screen"
import type { Variant } from "@/cli/types"
import type { AlbumDensity, LayoutTemplate, Photo } from "@/types/album"

export interface PlanOptions {
  photos: readonly SelectedPhoto[]
  templates: readonly LayoutTemplate[]
  theme: string
  orientation: "portrait" | "landscape"
  density: AlbumDensity
  /** 만들 후보 개수 */
  count: number
  /** 기준 시드 — 같은 시드면 같은 후보들이 재현된다 */
  seed: number
  focusOnSubject: boolean
}

export function toPhotoSpecs(photos: readonly SelectedPhoto[]): PhotoSpec[] {
  return photos.map(({ photo, judgement }) => ({
    id: photo.id,
    width: photo.width,
    height: photo.height,
    date: photo.date,
    subject: judgement.subject,
  }))
}

export function toScoringPhotos(photos: readonly SelectedPhoto[]): ScoringPhoto[] {
  return photos.map(({ photo, judgement }) => ({
    id: photo.id,
    width: photo.width,
    height: photo.height,
    score: judgement.score,
    subject: judgement.subject,
    takenAt: photo.takenAt,
  }))
}

/** 렌더러(브라우저)에 넘길 Photo 형태로 변환한다. url은 로컬 서버가 제공하는 경로 */
export function toRenderPhotos(photos: readonly SelectedPhoto[], urlForPhoto: (id: string) => string): Photo[] {
  return photos.map(({ photo }) => ({
    id: photo.id,
    url: urlForPhoto(photo.id),
    width: photo.width,
    height: photo.height,
    date: photo.date,
    location: photo.location,
    path: photo.path,
  }))
}

/** 후보 앨범들을 만들어 점수순(높은 순)으로 돌려준다 */
export function planVariants(options: PlanOptions): Variant[] {
  const { photos, templates, theme, orientation, density, count, seed, focusOnSubject } = options

  const specs = toPhotoSpecs(photos)
  const scoringPhotos = toScoringPhotos(photos)

  const variants: Variant[] = []
  for (let index = 0; index < count; index++) {
    const variantSeed = seed + index
    const album = buildAlbum({
      photos: specs,
      templates,
      theme,
      orientation,
      density,
      focusOnSubject,
      rng: createRng(variantSeed),
      idSeed: `v${index}`,
    })

    variants.push({ index, seed: variantSeed, album, score: scoreAlbum(album, scoringPhotos) })
  }

  return variants.sort((a, b) => b.score.total - a.score.total)
}
