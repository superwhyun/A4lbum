---
name: a4lbum
description: 사진 폴더(OneDrive 동기화 폴더 포함)에서 A4 앨범 PDF를 만든다. 비전 AI로 쓸만한 사진만 고르고, 랜덤 레이아웃 후보를 여러 개 만든 뒤 점수가 가장 높은 것을 최종 앨범으로 출력한다. "앨범 만들어", "사진 정리해서 PDF로", "이번 달 사진 앨범" 같은 요청에 사용.
---

# A4lbum 앨범 생성

사진 폴더 → 선별 → 랜덤 레이아웃 후보 N개 → 점수 1위를 `final.pdf`로.

## 실행 위치

A4lbum 저장소 루트에서 실행한다. 최초 1회 `npm install` 필요.

## 기본 경로

```bash
npm run album -- run <사진폴더> --out <결과폴더> --variants 5
```

끝나면 `<결과폴더>/final.pdf`와 `<결과폴더>/report.json`이 생긴다.
사용자에게는 **최종 PDF 경로, 채택/탈락 장수, 페이지 수**를 보고한다.

## 비전 AI로 사진을 고를 때

### 이 장비에 비전 엔드포인트가 있으면

```bash
npm run album -- run <사진폴더> \
  --vision-url <엔드포인트>/v1 --vision-model <모델> --out <결과폴더>
```

### 직접 사진을 보고 판정할 때 (2단계)

```bash
npm run album -- scan <사진폴더> -o manifest.json
```

`manifest.json`의 `photos[]`를 읽고, 각 사진(`path`)을 확인한 뒤 판정 파일을 쓴다:

```json
{ "judgements": [
  { "id": "<photos[].id>", "keep": true, "score": 0.87,
    "subject": { "x": 46, "y": 32 }, "reason": "인물 표정 좋음" }
] }
```

- `score`는 0-1, `subject`는 주피사체 중심(이미지 크기 대비 %)이다. `subject`를 주면 프레임 안에서 사진 위치가 자동 보정된다.
- 흐림·눈감음·노출 실패·유사컷은 `keep: false`로 떨어뜨린다.
- 매니페스트의 `quality` 지표(선명도/노출)를 1차 근거로 삼고, 애매한 것만 직접 확인하면 빠르다.

그다음:

```bash
npm run album -- build -m manifest.json --scores <판정파일> --out <결과폴더>
```

## 자주 쓰는 조정

| 상황 | 옵션 |
|---|---|
| 사진이 너무 빽빽함 | `--density sparse` |
| 페이지 수를 줄이고 싶음 | `--density dense` |
| 후보를 더 보고 싶음 | `--variants 10 --render-all` |
| 같은 결과를 다시 뽑기 | `--seed <report.json의 winner.seed>` |
| 날짜/장소 표기 제거 | `--no-metadata` |
| 하위 폴더까지 | `-r` |
| 위치정보를 외부로 보내지 않기 | `--no-geocode` |

## 주의

- 결과가 마음에 안 들면 사진을 다시 스캔하지 말고 **같은 매니페스트로 `build`만 다시** 돌린다 (스캔이 가장 느리다).
- `report.json`의 `rejected[]`에 탈락 사유가 있다. 사용자가 "왜 이 사진이 빠졌냐"고 물으면 여기서 답한다.
- 점수 기준을 바꾸고 싶다는 요청은 `--min-score` 조정으로 먼저 대응한다.
- 자세한 옵션과 판정 형식은 `cli/README.md` 참고.
