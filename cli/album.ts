#!/usr/bin/env tsx
// A4lbum CLI — 이미지 폴더에서 A4 앨범 PDF를 만든다.
// hermes 같은 외부 에이전트가 scan → (비전 판정) → build 순서로 호출하는 것을 전제로 설계.
import { readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Command, InvalidArgumentError } from "commander"
import { buildAlbums } from "@/cli/commands/build"
import { scanDirectory } from "@/cli/commands/scan"
import { readEnv } from "@/cli/env"
import { fileProvider, heuristicProvider, httpProvider, type VisionProvider } from "@/cli/select/providers"
import { upgradeManifest } from "@/cli/ingest/manifest"
import type { ScanManifest } from "@/cli/types"
import type { LayoutSource } from "@/lib/album-generator"
import { THEMES, type AlbumDensity } from "@/types/album"

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const DEFAULTS = {
  theme: "classic",
  title: "" as string,
  orientation: "portrait" as const,
  density: "medium" as AlbumDensity,
  variants: 5,
  minScore: 0.42,
  duplicateDistance: 8,
  manifest: "manifest.json",
  outDir: "album-out",
  groupGap: 180,
  groupDistance: 5,
  layout: "both" as LayoutSource,
  subjectPadding: 0.1,
  margin: 8,
} as const

const DENSITIES: readonly AlbumDensity[] = ["sparse", "medium", "dense"]
const LAYOUT_SOURCES: readonly LayoutSource[] = ["procedural", "templates", "both"]

function parsePositiveNumber(value: string): number {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidArgumentError("0보다 큰 수를 입력하세요")
  }
  return parsed
}

function parseNonNegativeNumber(value: string): number {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new InvalidArgumentError("0 이상의 수를 입력하세요")
  }
  return parsed
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidArgumentError("1 이상의 정수를 입력하세요")
  }
  return parsed
}

function parseNonNegativeInt(value: string): number {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new InvalidArgumentError("0 이상의 정수를 입력하세요")
  }
  return parsed
}

function parseRatio(value: string): number {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new InvalidArgumentError("0에서 1 사이의 값을 입력하세요")
  }
  return parsed
}

function parseChoice<T extends string>(allowed: readonly T[], label: string) {
  return (value: string): T => {
    if (!allowed.includes(value as T)) {
      throw new InvalidArgumentError(`${label}: ${allowed.join(", ")} 중 하나여야 합니다`)
    }
    return value as T
  }
}

interface SelectionFlags {
  scores?: string
  visionUrl?: string
  visionModel?: string
  visionKey?: string
  visionConcurrency?: number
  minScore: number
}

function resolveProvider(flags: SelectionFlags): VisionProvider {
  if (flags.scores && flags.visionUrl) {
    throw new Error("--scores와 --vision-url은 동시에 쓸 수 없습니다")
  }

  if (flags.scores) return fileProvider(resolve(flags.scores))

  if (flags.visionUrl) {
    if (!flags.visionModel) throw new Error("--vision-url을 쓸 때는 --vision-model도 필요합니다")
    return httpProvider({
      baseUrl: flags.visionUrl,
      model: flags.visionModel,
      apiKey: flags.visionKey,
      concurrency: flags.visionConcurrency,
    })
  }

  return heuristicProvider(flags.minScore)
}

async function loadManifest(path: string): Promise<ScanManifest> {
  const raw = await readFile(resolve(path), "utf8")
  return upgradeManifest(JSON.parse(raw) as ScanManifest)
}

interface ScanFlags {
  out: string
  recursive: boolean
  geocode: boolean
  concurrency?: number
}

async function runScan(dir: string, flags: ScanFlags): Promise<ScanManifest> {
  const kakaoApiKey = flags.geocode ? await readEnv("NEXT_PUBLIC_KAKAO_API_KEY", projectRoot) : undefined

  const { manifest, failed } = await scanDirectory({
    dir,
    recursive: flags.recursive,
    geocode: flags.geocode,
    kakaoApiKey,
    concurrency: flags.concurrency,
    onProgress: (done, total, fileName) => {
      if (done === total || done % 10 === 0) {
        process.stderr.write(`\r[scan] ${done}/${total} ${fileName.slice(0, 40).padEnd(40)}`)
      }
    },
  })

  process.stderr.write("\n")
  for (const failure of failed) {
    console.warn(`[scan] 건너뜀: ${failure.path} — ${failure.reason}`)
  }

  const outPath = resolve(flags.out)
  await writeFile(outPath, JSON.stringify(manifest, null, 2), "utf8")
  console.log(`[scan] 사진 ${manifest.photos.length}장 → ${outPath}`)

  return manifest
}

interface BuildFlags extends SelectionFlags {
  out: string
  title: string
  theme: string
  orientation: "portrait" | "landscape"
  density: AlbumDensity
  variants: number
  seed?: number
  dupDistance: number
  maxPhotos?: number
  renderAll: boolean
  metadata: boolean
  groupGap: number
  groupDistance: number
  /** --no-grouping이면 false */
  grouping: boolean
  layout: LayoutSource
  subjectPadding: number
  cover?: string
  margin: number
  captions: boolean
}

async function runBuild(manifest: ScanManifest, flags: BuildFlags): Promise<void> {
  const provider = resolveProvider(flags)

  const result = await buildAlbums({
    manifest,
    outDir: resolve(flags.out),
    provider,
    theme: flags.theme,
    title: flags.title,
    orientation: flags.orientation,
    density: flags.density,
    variants: flags.variants,
    seed: flags.seed ?? Date.now() % 100000,
    minScore: flags.minScore,
    duplicateDistance: flags.dupDistance,
    maxPhotos: flags.maxPhotos,
    renderAll: flags.renderAll,
    showMetadata: flags.metadata,
    layoutSource: flags.layout,
    grouping: flags.grouping
      ? { hardGapMinutes: flags.groupGap, hardDistanceKm: flags.groupDistance }
      : false,
    subjectPadding: flags.subjectPadding,
    coverFileName: flags.cover,
    margin: flags.margin,
    captions: flags.captions,
    onLog: (message) => console.log(`[build] ${message}`),
  })

  console.log(`[build] 리포트: ${result.reportPath}`)
}

function addSelectionOptions(command: Command): Command {
  return command
    .option("--scores <file>", "외부 비전 판정 결과 JSON (hermes 등이 생성)")
    .option("--vision-url <url>", "OpenAI 호환 비전 엔드포인트 (예: http://host:11434/v1)")
    .option("--vision-model <model>", "비전 모델 이름")
    .option("--vision-key <key>", "비전 엔드포인트 API 키")
    .option("--vision-concurrency <n>", "비전 동시 요청 수", parsePositiveInt)
    .option("--min-score <ratio>", "채택 최소 점수 (0-1)", parseRatio, DEFAULTS.minScore)
}

function addBuildOptions(command: Command): Command {
  return addSelectionOptions(command)
    .option("-o, --out <dir>", "결과 폴더", DEFAULTS.outDir)
    .option("--title <text>", "표지(첫 페이지) 타이틀. 지정하지 않으면 대표 사진 촬영일을 사용")
    .option("--theme <theme>", `앨범 테마 (${THEMES.join(", ")})`, parseChoice(THEMES, "테마"), DEFAULTS.theme)
    .option(
      "--orientation <orientation>",
      "용지 방향",
      parseChoice(["portrait", "landscape"] as const, "방향"),
      DEFAULTS.orientation,
    )
    .option("--density <density>", "페이지당 사진 밀도", parseChoice(DENSITIES, "밀도"), DEFAULTS.density)
    .option("--variants <n>", "생성할 후보 앨범 개수", parsePositiveInt, DEFAULTS.variants)
    .option("--seed <n>", "난수 시드 (지정하면 결과 재현 가능)", parseNonNegativeInt)
    .option("--dup-distance <n>", "유사컷 판정 거리 (0이면 끔)", parseNonNegativeInt, DEFAULTS.duplicateDistance)
    .option("--max-photos <n>", "앨범에 넣을 최대 장수", parsePositiveInt)
    .option("--render-all", "후보 전부를 PDF로 저장", false)
    .option("--no-metadata", "사진에 날짜/장소 표기 넣지 않음")
    .option("--group-gap <min>", "이 간격(분)을 넘으면 새 그룹", parsePositiveNumber, DEFAULTS.groupGap)
    .option("--group-distance <km>", "이 거리(km) 넘게 이동하면 새 그룹", parsePositiveNumber, DEFAULTS.groupDistance)
    .option("--no-grouping", "시간/장소 그룹 없이 시간순으로만 페이지 나눔")
    .option(
      "--layout <source>",
      "페이지 레이아웃 후보 (procedural: 사진에 맞춘 행/열, templates: 기본 템플릿, both)",
      parseChoice(LAYOUT_SOURCES, "레이아웃"),
      DEFAULTS.layout,
    )
    .option("--subject-padding <ratio>", "피사체 상자 여백 비율 (위쪽은 2배)", parseRatio, DEFAULTS.subjectPadding)
    .option("--cover <fileName>", "표지로 쓸 사진 파일 이름 (기본은 자동 선택)")
    .option("--margin <mm>", "페이지 여백 (mm)", parseNonNegativeNumber, DEFAULTS.margin)
    .option("--captions", "그룹 첫 페이지에 날짜 · 장소 캡션", false)
}

const program = new Command()
  .name("album")
  .description("이미지 폴더에서 A4 앨범 PDF를 만든다")
  .showHelpAfterError()

program
  .command("scan")
  .description("폴더를 훑어 사진 목록과 화질 지표를 매니페스트로 저장")
  .argument("<dir>", "이미지 폴더")
  .option("-o, --out <file>", "매니페스트 경로", DEFAULTS.manifest)
  .option("-r, --recursive", "하위 폴더까지", false)
  .option("--no-geocode", "GPS → 주소 변환 건너뜀")
  .option("--concurrency <n>", "동시 처리 장수", parsePositiveInt)
  .action(async (dir: string, flags: ScanFlags) => {
    await runScan(dir, flags)
  })

addBuildOptions(
  program
    .command("build")
    .description("매니페스트로 후보 앨범을 만들고 최고 점수 앨범을 PDF로 출력")
    .option("-m, --manifest <file>", "매니페스트 경로", DEFAULTS.manifest),
).action(async (flags: BuildFlags & { manifest: string }) => {
  const manifest = await loadManifest(flags.manifest)
  await runBuild(manifest, flags)
})

addBuildOptions(
  program
    .command("run")
    .description("scan과 build를 한 번에 (에이전트가 호출하는 기본 경로)")
    .argument("<dir>", "이미지 폴더")
    .option("-r, --recursive", "하위 폴더까지", false)
    .option("--no-geocode", "GPS → 주소 변환 건너뜀")
    .option("--manifest-out <file>", "매니페스트도 함께 저장"),
).action(async (dir: string, flags: BuildFlags & ScanFlags & { manifestOut?: string }) => {
  const kakaoApiKey = flags.geocode ? await readEnv("NEXT_PUBLIC_KAKAO_API_KEY", projectRoot) : undefined

  const { manifest, failed } = await scanDirectory({
    dir,
    recursive: flags.recursive,
    geocode: flags.geocode,
    kakaoApiKey,
    onProgress: (done, total) => {
      if (done === total || done % 10 === 0) process.stderr.write(`\r[scan] ${done}/${total}`)
    },
  })
  process.stderr.write("\n")

  for (const failure of failed) {
    console.warn(`[scan] 건너뜀: ${failure.path} — ${failure.reason}`)
  }
  console.log(`[scan] 사진 ${manifest.photos.length}장`)

  if (flags.manifestOut) {
    await writeFile(resolve(flags.manifestOut), JSON.stringify(manifest, null, 2), "utf8")
  }

  await runBuild(manifest, flags)
})

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(`[album] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
