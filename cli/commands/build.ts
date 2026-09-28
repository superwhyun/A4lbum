// build: 판정 → 선별 → 후보 앨범 N개 → 점수 → 최종 A4 PDF
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { loadTemplates } from "@/cli/plan/templates"
import { planVariants, toRenderPhotos } from "@/cli/plan/variants"
import { createRenderer } from "@/cli/render/pdf"
import { screenPhotos, type RejectedPhoto, type SelectedPhoto } from "@/cli/select/screen"
import type { VisionProvider } from "@/cli/select/providers"
import type { Judgement, ScanManifest, Variant } from "@/cli/types"
import type { LayoutSource } from "@/lib/album-generator"
import type { SubjectPadding } from "@/lib/layout/geometry"
import type { GroupingOptions } from "@/lib/layout/grouping"
import type { AlbumDensity } from "@/types/album"

const FINAL_PDF = "final.pdf"
const REPORT_JSON = "report.json"
const VARIANTS_DIR = "variants"

export interface BuildOptions {
  manifest: ScanManifest
  outDir: string
  provider: VisionProvider
  theme: string
  /** 표지(첫 페이지) 타이틀. 미지정 시 대표 사진 촬영일 사용 */
  title?: string
  orientation: "portrait" | "landscape"
  density: AlbumDensity
  variants: number
  seed: number
  minScore: number
  duplicateDistance: number
  maxPhotos?: number
  /** 후보 전부를 PDF로 남길지 (기본은 최종 1개만 렌더) */
  renderAll: boolean
  showMetadata: boolean
  /** procedural: 사진에 맞춘 행/열, templates: 기본 템플릿, both: 둘 다 후보 (기본) */
  layoutSource?: LayoutSource
  /** false면 그룹 없이 시간순으로만 페이지를 나눈다 */
  grouping?: GroupingOptions | false
  /** 피사체 상자 옆/아래 여백 비율 (위쪽은 2배). 기본 0.1 */
  subjectPadding?: number
  /** 표지로 쓸 파일 이름 */
  coverFileName?: string
  /** 페이지 여백 (mm) */
  margin?: number
  /** 그룹 첫 페이지에 "날짜 · 장소" 캡션 */
  captions?: boolean
  onLog?: (message: string) => void
}

/** 피사체 여백 비율 하나로 옆/위/아래 여백을 만든다 (위쪽은 얼굴 위 여백으로 2배) */
function paddingFromRatio(ratio: number): SubjectPadding {
  return { side: ratio, top: ratio * 2, bottom: ratio }
}

const round = (value: number, digits = 2): number => Number(value.toFixed(digits))
const isoOrUndefined = (epochMs?: number): string | undefined =>
  epochMs !== undefined ? new Date(epochMs).toISOString() : undefined

export interface BuildResult {
  kept: SelectedPhoto[]
  rejected: RejectedPhoto[]
  judgements: Judgement[]
  variants: Variant[]
  winner: Variant
  finalPath: string
  variantPaths: string[]
  reportPath: string
}

export async function buildAlbums(options: BuildOptions): Promise<BuildResult> {
  const log = options.onLog ?? (() => undefined)
  const photos = options.manifest.photos

  if (photos.length === 0) throw new Error("매니페스트에 사진이 없습니다")

  log(`판정 시작 (${options.provider.name}, ${photos.length}장)`)
  const judgements = await options.provider.judge(photos)

  const { kept, rejected } = screenPhotos(photos, judgements, {
    minScore: options.minScore,
    duplicateDistance: options.duplicateDistance,
    maxPhotos: options.maxPhotos,
  })

  log(`선별 결과: 채택 ${kept.length}장 / 제외 ${rejected.length}장`)
  if (kept.length === 0) {
    throw new Error("채택된 사진이 없습니다. --min-score를 낮추거나 판정 기준을 확인하세요")
  }

  let coverPhotoId: string | undefined
  if (options.coverFileName) {
    coverPhotoId = kept.find(({ photo }) => photo.fileName === options.coverFileName)?.photo.id
    if (!coverPhotoId) log(`표지 파일을 채택 사진에서 찾지 못했습니다: ${options.coverFileName} — 자동 선택`)
  }

  const templates = loadTemplates(options.orientation)
  const variants = planVariants({
    photos: kept,
    templates,
    theme: options.theme,
    orientation: options.orientation,
    density: options.density,
    count: Math.max(1, options.variants),
    seed: options.seed,
    placement: "subject",
    layoutSource: options.layoutSource,
    grouping: options.grouping,
    padding: options.subjectPadding !== undefined ? paddingFromRatio(options.subjectPadding) : undefined,
    margin: options.margin,
    coverPhotoId,
    captions: options.captions,
  })

  const winner = variants[0]
  if (winner.groupingMode === "chronological") {
    log("촬영 시각을 믿을 수 있는 사진이 적어 그룹 없이 시간순으로 나눕니다")
  } else if (winner.groupingMode === "grouped") {
    log(`그룹 ${winner.groups.length}개 (시간/장소 기준)`)
  }
  if (winner.diagnostics.contained.length > 0) {
    log(`피사체를 자르지 않으려고 레터박스로 넣은 사진 ${winner.diagnostics.contained.length}장`)
  }
  // --title 지정 시 모든 후보의 표지(첫 페이지) 타이틀을 교체한다 (CLI 전용 — 웹 공유 코드 건드리지 않음)
  if (options.title) {
    for (const variant of variants) {
      const cover = variant.album.pages[0]
      if (cover) cover.title = options.title
    }
  }
  log(
    `후보 ${variants.length}개 생성 — 최고 점수 ${winner.score.total.toFixed(3)} ` +
      `(seed=${winner.seed}, ${winner.album.pages.length}페이지)`,
  )

  await mkdir(options.outDir, { recursive: true })

  const renderer = await createRenderer(
    kept.map(({ photo }) => ({ id: photo.id, path: photo.path })),
  )
  const renderPhotos = toRenderPhotos(kept, renderer.photoUrl)

  const variantPaths: string[] = []
  let finalPath = ""

  try {
    const toRender = options.renderAll ? variants : [winner]

    if (options.renderAll) {
      await mkdir(join(options.outDir, VARIANTS_DIR), { recursive: true })
    }

    for (const variant of toRender) {
      const pdf = await renderer.render(variant.album, renderPhotos, options.showMetadata)

      if (variant === winner) {
        finalPath = join(options.outDir, FINAL_PDF)
        await writeFile(finalPath, pdf)
        log(`최종 앨범 저장: ${finalPath} (${(pdf.length / 1024 / 1024).toFixed(1)}MB)`)
      }

      if (options.renderAll) {
        const variantPath = join(options.outDir, VARIANTS_DIR, `variant-${variant.index}.pdf`)
        await writeFile(variantPath, pdf)
        variantPaths.push(variantPath)
      }
    }
  } finally {
    await renderer.close()
  }

  const fileNameOf = new Map(kept.map(({ photo }) => [photo.id, photo.fileName]))
  const pagesOfGroup = (groupId: string): number[] =>
    winner.album.pages.flatMap((page, index) => (page.groupIds?.includes(groupId) ? [index] : []))

  const reportPath = join(options.outDir, REPORT_JSON)
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceDir: options.manifest.sourceDir,
        provider: options.provider.name,
        settings: {
          theme: options.theme,
          orientation: options.orientation,
          density: options.density,
          variants: options.variants,
          seed: options.seed,
          minScore: options.minScore,
          duplicateDistance: options.duplicateDistance,
          maxPhotos: options.maxPhotos,
          layoutSource: options.layoutSource ?? "both",
          grouping: options.grouping ?? {},
          subjectPadding: options.subjectPadding,
          margin: options.margin,
          cover: options.coverFileName,
          captions: options.captions ?? false,
        },
        winner: { index: winner.index, seed: winner.seed, score: winner.score, pages: winner.album.pages.length },
        variants: variants.map((variant) => ({
          index: variant.index,
          seed: variant.seed,
          pages: variant.album.pages.length,
          score: variant.score,
        })),
        grouping: {
          mode: winner.groupingMode,
          groups: winner.groups.length,
        },
        groups: winner.groups.map((group) => ({
          id: group.id,
          start: isoOrUndefined(group.start),
          end: isoOrUndefined(group.end),
          location: group.location,
          boundaryAfter: group.boundaryAfter,
          photoIds: group.photoIds,
          fileNames: group.photoIds.map((id) => fileNameOf.get(id)),
          pages: pagesOfGroup(group.id),
        })),
        cover: winner.diagnostics.cover,
        pages: winner.album.pages.map((page, index) => ({
          index,
          layout: page.isCoverPage ? "cover" : winner.diagnostics.pageLabels[index - (winner.diagnostics.cover ? 1 : 0)],
          groupIds: page.groupIds,
          continued: page.continued ?? false,
          photos: page.layouts.length,
        })),
        placements: winner.diagnostics.placements.map((placement) => ({
          id: placement.photoId,
          fileName: fileNameOf.get(placement.photoId),
          page: placement.pageIndex,
          cell: {
            x: round(placement.cell.x),
            y: round(placement.cell.y),
            width: round(placement.cell.width),
            height: round(placement.cell.height),
          },
          photoX: round(placement.photoX),
          photoY: round(placement.photoY),
          fit: placement.fit,
          subjectCut: round(placement.subjectCut, 4),
        })),
        contained: winner.diagnostics.contained.map((id) => fileNameOf.get(id) ?? id),
        kept: kept.map(({ photo, judgement }) => ({
          id: photo.id,
          fileName: photo.fileName,
          date: photo.date,
          takenAt: photo.takenAt,
          timeSource: photo.timeSource,
          score: judgement.score,
          subject: judgement.subject,
          source: judgement.source,
        })),
        rejected: rejected.map(({ photo, reason }) => ({
          id: photo.id,
          fileName: photo.fileName,
          reason,
        })),
        outputs: { final: finalPath, variants: variantPaths },
      },
      null,
      2,
    ),
    "utf8",
  )

  return { kept, rejected, judgements, variants, winner, finalPath, variantPaths, reportPath }
}
