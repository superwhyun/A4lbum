# A4lbum CLI

이미지 폴더를 받아 랜덤 레이아웃 후보 앨범을 여러 개 만들고, 점수가 가장 높은 하나를 A4 PDF로 출력한다.
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
| `album-out/report.json` | 채택/탈락 사진, 후보별 점수, 설정값 |
| `album-out/variants/variant-N.pdf` | `--render-all`을 준 경우의 후보 전부 |

## 파이프라인

```
폴더 → ① scan → ② 판정 → ③ 선별 → ④ 후보 N개 → ⑤ 점수 → ⑥ final.pdf
```

1. **scan** — EXIF 촬영일/GPS, EXIF 회전을 반영한 실제 표시 크기, sharp 기반 화질 지표(선명도·노출·대비·정보량), 유사컷 판별용 dHash를 매니페스트에 기록.
2. **판정** — 사진별 `keep` / `score` / `subject`(주피사체 좌표)를 결정. 판정 주체는 교체 가능(아래 참조).
3. **선별** — 점수 컷오프 → 유사컷 그룹에서 최고점 1장만 → 촬영시간 정렬 → `--max-photos` 상한.
4. **후보 생성** — 시드 난수로 템플릿을 골라 서로 다른 배치의 앨범을 N개 구성. 같은 시드면 항상 같은 앨범이 재현된다.
5. **점수** — 잘림 정도, 피사체 보존, 사진 화질, 지면 채움, 시간순, 페이지 밀도 균형의 가중합.
6. **렌더** — 1위 앨범만 렌더(기본). 후보 전부가 필요하면 `--render-all`.

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
      "subject": { "x": 46, "y": 32 },
      "reason": "선명하고 인물 표정 좋음"
    }
  ]
}
```

- `id` — 매니페스트의 `photos[].id`. 파일 경로 기반이라 재실행해도 같은 값이다.
- `keep` — 생략하면 `true`.
- `score` — 0-1. 범위를 벗어나면 잘라낸다.
- `subject` — 원본 이미지 크기 대비 %. 이 좌표가 프레임 중앙에 오도록 `photoX/photoY`가 자동 보정된다.
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
| `--density <d>` | medium | sparse(1-2) / medium(3-5) / dense(5-8) 장/페이지 |
| `--min-score <0-1>` | 0.42 | 채택 하한 |
| `--dup-distance <n>` | 8 | 유사컷 판정 거리. 0이면 끔 |
| `--max-photos <n>` | 제한 없음 | 앨범 최대 장수 |
| `--render-all` | 끔 | 후보 전부 PDF 저장 |
| `--no-metadata` | 표기함 | 사진 위 날짜/장소 표기 제거 |
| `-r, --recursive` | 끔 | 하위 폴더까지 (scan/run) |
| `--no-geocode` | 변환함 | GPS → 주소 변환 건너뜀 |

`--no-geocode`를 주지 않으면 GPS가 있는 사진에 한해 카카오 로컬 API로 주소를 조회한다
(웹 앱과 같은 엔드포인트, `NEXT_PUBLIC_KAKAO_API_KEY` 사용). 좌표가 외부로 나가는 유일한 지점이다.

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

레이아웃 구성 로직은 `lib/album-generator.ts`에 있고 웹 앱(`contexts/album-context.tsx`)도 같은 함수를 쓴다.
