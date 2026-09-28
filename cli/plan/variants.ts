// 같은 사진 묶음으로 후보 앨범을 여러 개 만든다.
// 0번은 최적해(결정론적), 나머지는 페이지마다 상위 후보 중 softmax로 고르고 목표 밀도를 흔든 변형이다.
import { createRng, planAlbum, type LayoutSource, type PhotoSpec } from "@/lib/album-generator"
import type { SubjectPadding } from "@/lib/layout/geometry"
import type { GroupingOptions } from "@/lib/layout/grouping"
import type { SolvedPage } from "@/lib/layout/page-cost"
import { scoreAlbum, type ScoringPhoto } from "@/cli/plan/score"
import type { SelectedPhoto } from "@/cli/select/screen"
import type { Variant } from "@/cli/types"
import type { AlbumDensity, LayoutTemplate, Photo } from "@/types/album"

/** 변형 후보의 목표 밀도 흔들기 폭 (±장) */
const VARIANT_DENSITY_JITTER = 1

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
  /** subject: 피사체 상자 기준 배치, center: 가운데 고정 */
  placement: "subject" | "center"
  layoutSource?: LayoutSource
  /** false면 그룹 없이 시간순으로만 */
  grouping?: GroupingOptions | false
  padding?: SubjectPadding
  /** 페이지 여백 (mm) */
  margin?: number
  /** 페이지당 최소 사진 개수 (기본 1) */
  minPerPage?: number
  coverPhotoId?: string
  captions?: boolean
}

export function toPhotoSpecs(photos: readonly SelectedPhoto[]): PhotoSpec[] {
  return photos.map(({ photo, judgement }) => {
    const takenAt = photo.takenAt ? Date.parse(photo.takenAt) : Number.NaN
    return {
      id: photo.id,
      width: photo.width,
      height: photo.height,
      date: photo.date,
      takenAt: Number.isFinite(takenAt) ? takenAt : undefined,
      timeSource: photo.timeSource ?? "unknown",
      gps: photo.gps,
      location: photo.location,
      subject: judgement.subject,
      score: judgement.score,
    }
  })
}

export function toScoringPhotos(
  photos: readonly SelectedPhoto[],
  groupOf: ReadonlyMap<string, string> = new Map(),
): ScoringPhoto[] {
  return photos.map(({ photo, judgement }) => ({
    id: photo.id,
    width: photo.width,
    height: photo.height,
    score: judgement.score,
    subject: judgement.subject,
    takenAt: photo.takenAt,
    groupId: groupOf.get(photo.id),
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
  const { photos, templates, theme, orientation, density, count, seed } = options
  const specs = toPhotoSpecs(photos)
  // 모든 후보가 같은 사진·옵션을 쓰므로 구간별 레이아웃 풀이를 공유한다
  const layoutCache = new Map<string, SolvedPage[]>()

  const variants: Variant[] = []
  for (let index = 0; index < count; index++) {
    const variantSeed = seed + index
    const optimal = index === 0

    const result = planAlbum({
      photos: specs,
      templates,
      theme,
      orientation,
      density,
      placement: options.placement,
      layoutSource: options.layoutSource ?? "both",
      grouping: options.grouping ?? {},
      minPerPage: options.minPerPage,
      padding: options.padding,
      margins: options.margin !== undefined ? { margin: options.margin } : undefined,
      coverPhotoId: options.coverPhotoId,
      captions: options.captions,
      rng: optimal ? undefined : createRng(variantSeed),
      densityJitter: optimal ? 0 : VARIANT_DENSITY_JITTER,
      idSeed: `v${index}`,
      layoutCache,
    })

    const groupOf = new Map<string, string>()
    for (const group of result.groups) for (const id of group.photoIds) groupOf.set(id, group.id)

    variants.push({
      index,
      seed: variantSeed,
      album: result.album,
      score: scoreAlbum(result.album, toScoringPhotos(photos, groupOf), { marginMm: options.margin }),
      groups: result.groups,
      groupingMode: result.groupingMode,
      diagnostics: result.diagnostics,
    })
  }

  return variants.sort((a, b) => b.score.total - a.score.total)
}
