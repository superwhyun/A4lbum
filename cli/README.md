# A4lbum CLI

이미지 폴더를 받아 사진을 시간/장소로 묶고, 피사체가 잘리지 않도록 사진에 맞춘 페이지를 구성한 후보 앨범을 여러 개 만든 뒤, 점수가 가장 높은 하나를 A4 PDF로 출력한다.
웹 앱과 **같은 레이아웃 엔진(`lib/album-generator.ts`)과 같은 PDF 렌더 경로(`utils/pdf-export.ts`)** 를 쓴다.
CLI는 그 코드를 헤드리스 Chrome 안에서 실행할 뿐이라 웹 출력과 결과가 어긋나지 않는다.

## 빠른 시작

```bash
# 한 번에 (스캔 + 앨범 생성)
npm run album -- run ~/OneDrive/Pictures/2026-09 --out ./album-out --variants 5

# 단계별
npm run album -- scan ~/OneDrive/Pictures/2026-09 -o manifest.json
npm run album -- build -m manifest.json --out ./album-out
```

결과물:

| 파일 | 내용 |
|---|---|
| `album-out/final.pdf` | 점수 1위 앨범 (최종 결과물) |
| `album-out/report.json` | 채택/탈락 사진, 후보별 점수, 그룹, 사진별 배치, 설정값 |
| `album-out/variants/variant-N.pdf` | `--render-all`을 준 경우의 후보 전부 |

## 파이프라인

```
폴더 → ① scan → ② 판정 → ③ 선별 → ④ 후보 N개 → ⑤ 점수 → ⑥ final.pdf
```

1. **scan** — 촬영 시각(+출처 `timeSource`)/GPS, EXIF 회전을 반영한 실제 표시 크기, sharp 기반 화질 지표(선명도·노출·대비·정보량), 유사컷 판별용 dHash를 매니페스트에 기록.
   촬영 시각은 EXIF 촬영일 → 파일명(`IMG_20240512_143012`, `Screenshot_2024-05-12-14-30-12` 등) → 파일 mtime 순으로 정한다.
   mtime은 OneDrive 동기화 시각일 수 있어 `timeSource: "mtime"`으로 표시되고 그룹 경계 근거로 쓰지 않는다.
2. **판정** — 사진별 `keep` / `score` / `subject`(주피사체 경계상자)를 결정. 판정 주체는 교체 가능(아래 참조).
3. **선별** — 점수 컷오프 → 유사컷 그룹에서 최고점 1장만 → 촬영시간 정렬 → `--max-photos` 상한.
4. **계획** (`planAlbum`, 웹과 공유)
   - **표지** — 전면(페이지 비율)으로 넣어도 피사체가 잘리지 않는 사진 중 점수가 가장 높은 것. 없으면 원본 비율 그대로 액자형 표지.
   - **그룹** — 시간순 이웃 사이에서만 자른다: 5km 넘게 이동, 날짜가 바뀌고 1시간 넘게 쉼, 3시간 넘게 쉼 → 확실한 경계.
     45분 넘게 쉬고 장소가 바뀜(또는 GPS 없음) → 약한 경계. 1장짜리 그룹은 같은 날 가까운 이웃에 붙는다.
     시간 정보를 믿을 수 없는 사진이 절반을 넘고 GPS도 없으면 그룹 없이 시간순으로만 나눈다.
   - **페이지 나누기** — 타임라인 위 동적 계획법. 레이아웃 비용 + 페이지 수 + 밀도 목표와의 차이 + 페이지 안에 들어간 경계 비용을 최소화한다.
     큰 그룹은 가장 좋은 지점에서 나뉘고(7장 → 4+3), 확실한 경계는 거의 넘지 않는다.
   - **페이지 레이아웃** — 사진 순서대로 행(또는 열)을 나누는 모든 구조를 풀어본다. 각 셀 비율은 "피사체를 자르지 않는 비율 범위" 안에서 정해지고,
     남는 불일치는 사진을 자르지 않고 페이지 여백으로 흡수한다. 기본 템플릿도 같은 기준으로 후보가 된다 (`--layout`).
   - **배치** — 셀 안에서 피사체 상자 전체가 보이도록 `photoX/photoY`를 정한다 (얼굴 위 여백 포함). 어떤 셀에도 못 들어가는 극단적인 경우만 레터박스(`fit: "contain"`).
   - **후보** — 0번은 최적해, 나머지는 페이지마다 상위 구조 중 무작위 선택 + 밀도 목표를 ±1 흔든 변형. 같은 시드면 항상 같은 결과.
5. **점수** — 피사체 보존(경계상자 기준) 0.3, 잘림 0.2, 지면 채움 0.15, 그룹 응집 0.15, 사진 화질 0.1, 시간순 0.05, 균형 0.05의 가중합.
6. **렌더** — 1위 앨범만 렌더(기본). 후보 전부가 필요하면 `--render-all`. 모든 사진은 sharp로 EXIF 회전을 적용한 JPEG로 바꿔 브라우저에 넘긴다.

## 판정 주체 교체 (hermes 연동 지점)

세 가지 경로가 있고, 모두 같은 `Judgement` 형식으로 수렴한다.

### 1) 기본: 로컬 휴리스틱 (AI 없이도 동작)

```bash
npm run album -- run ./photos --out ./out
```

sharp 지표만 사용한다. 흐린 사진은 다른 지표가 좋아도 통과하지 못하도록 선명도 게이트가 걸려 있다.

### 2) 외부 에이전트가 판정 파일을 주는 경우 (다른 장비의 hermes)

```bash
# hermes 쪽
npm run album -- scan ./photos -o manifest.json     # ① 매니페스트 생성
#   → hermes가 manifest.json의 각 photo를 보고 scores.json 작성
npm run album -- build -m manifest.json --scores scores.json --out ./out
```

`scores.json` 형식:

```json
{
  "judgements": [
    {
      "id": "p-e9506e69b6",
      "keep": true,
      "score": 0.87,
      "subject": { "x": 46, "y": 32, "w": 30, "h": 24 },
      "reason": "선명하고 인물 표정 좋음"
    }
  ]
}
```

- `id` — 매니페스트의 `photos[].id`. 파일 경로 기반이라 재실행해도 같은 값이다.
- `keep` — 생략하면 `true`.
- `score` — 0-1. 범위를 벗어나면 잘라낸다. 표지 선택에도 쓰인다.
- `subject` — 주피사체 **경계상자**. `x/y`는 상자 중심, `w/h`는 상자 크기로 모두 원본 이미지 크기 대비 %.
  여러 사람이면 모든 얼굴을 포함하는 상자를 준다. 이 상자(+여백)가 잘리지 않는 셀 비율만 쓰이고, 상자가 창 안에 들어오도록 `photoX/photoY`가 정해진다.
  이미지 밖으로 나간 상자는 가장자리에서 잘라 정리한다. `w/h`를 생략하면 그 점을 포함하는 가운데 70% 영역을 지킨다.
- 목록에 없는 사진은 화질 점수로 대체된다. 일부만 판정해도 동작한다.

### 3) OpenAI 호환 비전 엔드포인트 직접 호출

```bash
npm run album -- run ./photos \
  --vision-url http://hermes-box.local:11434/v1 \
  --vision-model qwen2.5-vl:7b \
  --vision-concurrency 3 \
  --out ./out
```

ollama, LM Studio, 자체 서버 모두 동일 경로다. 사진은 긴 변 768px JPEG로 줄여 보내고,
모델이 설명을 덧붙여도 JSON 블록만 뽑아 쓴다. 한 장이 실패하면 그 장만 휴리스틱으로 대체하고 계속 진행한다.

## 주요 옵션

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `--variants <n>` | 5 | 후보 앨범 개수 |
| `--seed <n>` | 실행 시각 | 지정하면 결과 완전 재현 |
| `--theme <theme>` | classic | 웹 앱과 동일한 테마 목록 |
| `--orientation <o>` | portrait | portrait / landscape |
| `--density <d>` | medium | 페이지당 목표/최대 장수: sparse(2/3) / medium(4/6) / dense(6/9) |
| `--layout <src>` | both | procedural(사진에 맞춘 행/열) / templates(기본 템플릿) / both |
| `--group-gap <min>` | 180 | 이 간격(분)을 넘으면 새 그룹 |
| `--group-distance <km>` | 5 | 이 거리(km) 넘게 이동하면 새 그룹 |
| `--no-grouping` | 그룹함 | 그룹 없이 시간순으로만 페이지 나눔 |
| `--subject-padding <0-1>` | 0.1 | 피사체 상자 여백 비율 (위쪽은 2배 — 얼굴 위 여백) |
| `--cover <fileName>` | 자동 | 표지로 쓸 사진 파일 이름 |
| `--margin <mm>` | 8 | 페이지 여백 |
| `--captions` | 끔 | 그룹 첫 페이지 아래 여백에 "날짜 · 장소" 캡션 |
| `--min-score <0-1>` | 0.42 | 채택 하한 |
| `--dup-distance <n>` | 8 | 유사컷 판정 거리. 0이면 끔 |
| `--max-photos <n>` | 제한 없음 | 앨범 최대 장수 |
| `--render-all` | 끔 | 후보 전부 PDF 저장 |
| `--no-metadata` | 표기함 | 사진 위 날짜/장소 표기 제거 |
| `-r, --recursive` | 끔 | 하위 폴더까지 (scan/run) |
| `--no-geocode` | 변환함 | GPS → 주소 변환 건너뜀 |

`--no-geocode`를 주지 않으면 GPS가 있는 사진에 한해 카카오 로컬 API로 주소를 조회한다
(웹 앱과 같은 엔드포인트, `NEXT_PUBLIC_KAKAO_API_KEY` 사용). 좌표가 외부로 나가는 유일한 지점이다.
그룹 나누기는 주소가 아니라 GPS 좌표 자체를 쓰므로 `--no-geocode`여도 동작한다.

## report.json

기존 필드(`winner`, `variants[]`, `kept[]`, `rejected[]`, `outputs`)에 더해:

| 필드 | 내용 |
|---|---|
| `winner.score.subjectSafety` | 피사체 경계상자가 크롭 창 안에 남은 비율 (면적 가중). 정상이면 1.0 |
| `winner.score.groupCohesion` | 한 페이지가 한 그룹만 담는 정도 (+ 나뉜 그룹이 연속 페이지인지) |
| `grouping.mode` | `grouped` / `chronological`(시간 정보 부족) / `off`(`--no-grouping`) |
| `groups[]` | `id`, `start`, `end`, `location`, `boundaryAfter`, `photoIds`, `fileNames`, `pages` |
| `pages[]` | 페이지별 구조(`rows:2-1`, `template:<id>`, `cover`), 그룹, 이어지는 페이지 여부 |
| `placements[]` | 사진별 `page`, `cell`(mm), `photoX`, `photoY`, `fit`, `subjectCut`(잘린 피사체 비율, 0이 정상) |
| `contained[]` | 레터박스로 들어간 사진 파일 이름 |
| `kept[].timeSource` | 촬영 시각 출처 (exif / filename / mtime / unknown) |

예전(v1) `manifest.json`도 다시 scan하지 않고 그대로 build할 수 있다. 촬영 시각 출처는 파일명과 GPS로 추정한다.

## OneDrive 자동화

맥 OneDrive는 `~/OneDrive` 또는 `~/Library/CloudStorage/OneDrive-*`에 로컬 동기화되므로
Graph API 없이 폴더 경로만 있으면 된다. 온라인 전용(미다운로드) 파일은 읽기에 실패하면
경고만 남기고 건너뛴다.

## 요구사항

- Node 22+
- Chrome 또는 `npx playwright install chromium`
- 타이틀 폰트(나눔펜스크립트)는 구글 폰트에서 받아온다. 오프라인이면 기본 필기체로 대체되고 경고가 뜬다.

## 구조

```
cli/
├── album.ts              커맨드 정의 (scan / build / run)
├── commands/             단계 오케스트레이션
├── ingest/               파일 수집, EXIF, 화질 지표·해시
├── select/               판정 provider, 선별 로직
├── plan/                 템플릿 로드, 후보 생성, 점수
└── render/               Playwright + 로컬 서버 + 브라우저 번들
```

레이아웃 구성 로직은 `lib/album-generator.ts`(`planAlbum`, `buildAlbum`)와 `lib/layout/`에 있고 웹 앱(`contexts/album-context.tsx`)도 같은 함수를 쓴다.

```
lib/layout/
├── geometry.ts           피사체 상자, 허용 셀 비율 범위, 잘림 없는 photoX/photoY
├── grouping.ts           시간/장소 경계 판정, 그룹, 1장 그룹 합치기
├── page-layout.ts        행/열 구조 나열 + 셀 비율 풀이
├── template-fit.ts       템플릿 맞춤 (비트마스크 DP 배정)
├── page-cost.ts          페이지 비용 (여백·잘림·작은 셀·불균형)
└── paginate.ts           타임라인 DP 페이지 나누기
```
