# A4lbum

A4lbum은 사용자가 자신만의 사진 앨범을 만들고, 레이아웃을 커스터마이징하며, PDF로 내보낼 수 있는 웹 애플리케이션입니다. 이 프로젝트는 Next.js, React, TypeScript, Tailwind CSS를 사용하여 개발되었습니다.

## 주요 기능

- **사용자 인증:** Google 계정을 이용한 간편 로그인 및 자체 계정 생성 기능을 제공합니다.
- **앨범 생성 및 관리:** 사용자는 여러 개의 앨범을 생성하고 사진을 추가할 수 있습니다.
- **레이아웃 커스터마이징:** 다양한 템플릿을 제공하여 사용자가 원하는 대로 앨범 페이지 레이아웃을 꾸밀 수 있습니다.
- **PDF 내보내기:** 완성된 앨범을 고품질 PDF 파일로 내보내어 소장하거나 공유할 수 있습니다.
- **반응형 디자인:** 데스크톱, 태블릿, 모바일 등 다양한 디바이스에서 최적화된 화면을 제공합니다.

## 기술 스택

- **프레임워크:** [Next.js](https://nextjs.org/)
- **라이브러리:** [React](https://reactjs.org/)
- **언어:** [TypeScript](https://www.typescriptlang.org/)
- **스타일링:** [Tailwind CSS](https://tailwindcss.com/)
- **UI 컴포넌트:** [shadcn/ui](https://ui.shadcn.com/)
- **인증:** [Google OAuth](https://developers.google.com/identity/protocols/oauth2), [JWT](https://jwt.io/)
- **데이터베이스:** [PostgreSQL](https://www.postgresql.org/), [SQLite](https://www.sqlite.org/index.html)
- **PDF 생성:** [jsPDF](https://github.com/parallax/jsPDF), [html2canvas](https://html2canvas.hertzen.com/)

## 시작하기

### 1. 프로젝트 클론

```bash
git clone https://github.com/your-username/A4lbum.git
cd A4lbum
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 환경 변수를 설정합니다.

```
# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"

# JWT
JWT_SECRET="YOUR_JWT_SECRET"

# Database (PostgreSQL)
POSTGRES_URL="YOUR_POSTGRES_URL"
```

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속하여 애플리케이션을 확인할 수 있습니다.

## 빌드 및 배포

```bash
npm run build
```

위 명령어를 실행하면 프로덕션용으로 최적화된 빌드 파일이 생성됩니다.

```bash
npm start
```

빌드된 애플리케이션을 실행합니다.

## 라이선스

[MIT](LICENSE)
