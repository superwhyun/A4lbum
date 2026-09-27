# A4lbum

A4lbum은 사진으로 A4 크기 앨범을 만들어 PDF로 내보내는 프로젝트입니다.
브라우저에서 직접 편집하는 **웹 앱**과, 폴더를 통째로 넘기면 앨범을 만들어 주는 **CLI** 두 가지 방식이 있습니다.
둘은 같은 레이아웃 엔진과 같은 PDF 렌더 경로를 쓰기 때문에 결과물이 서로 어긋나지 않습니다.

## 주요 기능

### 웹 앱

- **앨범 생성:** 사진을 드래그&드롭으로 올리면 테마·방향·밀도에 따라 페이지가 자동 구성됩니다.
- **레이아웃 편집:** 편집 모드에서 사진 교체, 위치 조정, 페이지 추가/정리를 할 수 있습니다.
- **PDF 내보내기:** 300dpi 기준 고해상도로 렌더링합니다.
- **사용자 인증:** Google 로그인과 자체 계정을 지원합니다. 앨범 만들기 자체는 로그인 없이 됩니다.
- **템플릿 관리:** 관리자는 `/layout-manager`에서 모든 사용자가 쓰는 공용 템플릿을 관리합니다. 일반 사용자가 만든 템플릿은 브라우저에만 저장됩니다.

### CLI

- 이미지 폴더를 읽어 EXIF·화질 지표를 수집하고, 쓸 만한 사진만 골라 앨범 후보를 여러 개 만든 뒤 점수가 가장 높은 것을 PDF로 냅니다.
- 사진 판정은 교체 가능합니다 — 내장 휴리스틱, 외부 에이전트가 만든 판정 JSON, OpenAI 호환 비전 엔드포인트 중 선택.
- 자세한 사용법은 **[cli/README.md](cli/README.md)** 를 보세요.

```bash
npm run album -- run ~/OneDrive/Pictures/2026-09 --out ./album-out
```

## 기술 스택

- **프레임워크:** [Next.js](https://nextjs.org/) (App Router)
- **언어:** [TypeScript](https://www.typescriptlang.org/)
- **UI:** [React](https://reactjs.org/), [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/)
- **인증:** [Google OAuth](https://developers.google.com/identity/protocols/oauth2), [JWT](https://jwt.io/)
- **데이터베이스:** [PostgreSQL](https://www.postgresql.org/) (배포) / [SQLite](https://www.sqlite.org/index.html) (로컬)
- **PDF 생성:** [jsPDF](https://github.com/parallax/jsPDF)
- **CLI:** [sharp](https://sharp.pixelplumbing.com/), [exifr](https://github.com/MikeKovarik/exifr), [Playwright](https://playwright.dev/)
- **테스트:** [Jest](https://jestjs.io/)

## 시작하기

### 1. 프로젝트 클론

```bash
git clone https://github.com/superwhyun/A4lbum.git
cd A4lbum
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정

`.env.local` 파일을 만들고 아래 값을 채웁니다.

```bash
# Google OAuth 클라이언트 ID (로그인 사용 시 필수)
NEXT_PUBLIC_GOOGLE_CLIENT_ID="..."

# JWT 서명 키 — 필수. 없으면 인증 관련 요청이 실패합니다.
# 생성: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_SECRET="..."

# 데이터베이스. postgres 문자열이 있으면 PostgreSQL, 없으면 data/app.db(SQLite)를 씁니다.
DATABASE_URL="postgres://..."

# 사진 GPS를 주소로 바꿀 때 사용 (선택)
NEXT_PUBLIC_KAKAO_API_KEY="..."

# 관리자 계정을 처음 만들 때만 사용 (선택) — 아래 "관리자 계정" 참고
ADMIN_INITIAL_PASSWORD="..."
```

> `JWT_SECRET`에는 기본값이 없습니다. 예전에는 소스에 박힌 문자열을 쓰도록 되어 있었는데,
> 그 경우 누구나 관리자 토큰을 위조할 수 있어 제거했습니다. 배포 환경에도 반드시 설정하세요.

### 4. 관리자 계정

관리자는 공용 템플릿을 쓰고 지울 수 있는 유일한 역할입니다.

- `ADMIN_INITIAL_PASSWORD`가 설정된 상태로 처음 실행하면 그 비밀번호로 `admin` 계정이 만들어집니다.
- 설정하지 않으면 관리자 계정을 만들지 않습니다(경고만 출력). 관리자 없이도 앨범 기능은 정상 동작합니다.
- 비밀번호를 바꾸거나 나중에 계정을 만들려면:

```bash
node scripts/set-admin-password.js '새-비밀번호'                  # 로컬 SQLite
DATABASE_URL='postgres://...' node scripts/set-admin-password.js '새-비밀번호'   # 배포 DB
```

### 5. 개발 서버 실행

```bash
npm run dev
```

`http://localhost:3000`에서 확인할 수 있습니다.

## 테스트와 검사

```bash
npx jest             # 단위 테스트
npx jest --coverage  # 커버리지 포함
npm run lint         # ESLint
npm run build        # 프로덕션 빌드
```

## 빌드 및 배포

```bash
npm run build
npm start
```

배포 환경에는 최소한 `JWT_SECRET`과 `DATABASE_URL`을 설정해야 합니다.

## 프로젝트 구조

```
app/              Next.js App Router 페이지와 API 라우트
components/       UI 컴포넌트 (components/ui는 shadcn/ui)
contexts/         앨범·인증 상태
lib/              레이아웃 엔진, 템플릿, DB 어댑터, 인증 유틸
utils/            PDF 내보내기, EXIF, 얼굴 검출
cli/              앨범 생성 CLI (cli/README.md 참고)
scripts/          운영용 스크립트
```

레이아웃 구성 로직은 `lib/album-generator.ts`, PDF 렌더링은 `utils/pdf-export.ts`에 있고
웹과 CLI가 이 둘을 공유합니다.

## 라이선스

[MIT](LICENSE)
