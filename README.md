# Lipcoding (립메모)

브라우저에서 음성을 녹음하고, Azure Blob Storage에 저장한 뒤, Groq Whisper로 전사하여 텍스트를 편집/다운로드할 수 있는 Next.js 앱입니다.

## 주요 기능

- 브라우저 마이크 녹음 (시작/일시정지/재개/종료)
- 녹음 파일 Azure Blob Storage 업로드
- Groq API 기반 자동 음성 전사
- 전사 상태 관리 (대기/진행/완료/실패)
- 전사 텍스트 수정 및 저장
- TXT, Excel(xlsx) 다운로드
- 녹음 목록 조회/수정/삭제

## 기술 스택

- Frontend: Next.js 15, React 19
- Backend: Next.js Route Handlers
- Database: PostgreSQL + Prisma
- Storage: Azure Blob Storage
- STT: Groq Audio Transcription API (Whisper)
- Package Manager: pnpm 11

## 요구 사항

- Node.js 22+
- pnpm 11+
- Docker (로컬 PostgreSQL 실행 시)

## 빠른 시작 (로컬)

1. 의존성 설치

```bash
pnpm install
```

2. 환경 변수 파일 생성

```bash
cp .env.example .env
```

3. .env 값 설정

- DATABASE_URL
- GROQ_API_KEY (또는 GROQ_API_TOKEN)
- AZURE_STORAGE_CONNECTION_STRING
- AZURE_STORAGE_CONTAINER_NAME

4. 로컬 DB 실행

```bash
pnpm db:up
```

5. Prisma 마이그레이션 생성/적용

```bash
pnpm db:generate
```

6. 개발 서버 실행

```bash
pnpm dev
```

기본 접속: http://localhost:3000

## 환경 변수

| 변수명 | 설명 | 필수 |
| --- | --- | --- |
| DATABASE_URL | PostgreSQL 연결 문자열 | 예 |
| GROQ_API_KEY | Groq API 키 | 예 (GROQ_API_TOKEN 대체 가능) |
| GROQ_API_TOKEN | Groq API 키 대체 변수 | 아니오 |
| AZURE_STORAGE_CONNECTION_STRING | Azure Blob 연결 문자열 | 예 |
| AZURE_STORAGE_CONTAINER_NAME | Blob 컨테이너 이름 (기본 recordings) | 예 |
| NODE_ENV | 실행 환경 (development/test/production) | 아니오 |

## 자주 쓰는 명령어

```bash
# 개발
pnpm dev

# 빌드/실행
pnpm build
pnpm start

# 코드 품질
pnpm lint
pnpm typecheck
pnpm check

# 포맷
pnpm format:check
pnpm format:write

# DB
pnpm db:up
pnpm db:down
pnpm db:reset
pnpm db:migrate
pnpm db:push
pnpm db:studio
```

## Docker 실행

이미지 빌드:

```bash
pnpm docker:build
```

컨테이너 실행:

```bash
pnpm docker:up
```

로그 확인/종료:

```bash
pnpm docker:logs
pnpm docker:down
```

참고:

- docker:up 스크립트는 기본적으로 3003 포트를 사용합니다.
- 로컬 DB는 host.docker.internal 기준으로 접근합니다.

## API 개요

- GET /api/recordings: 녹음 목록 조회
- POST /api/recordings: 녹음 파일 업로드 및 레코드 생성
- GET /api/recordings/:id: 단건 조회
- PATCH /api/recordings/:id: 제목/전사 텍스트 수정
- DELETE /api/recordings/:id: 삭제
- POST /api/recordings/:id/transcribe: Groq 전사 실행
- GET /api/recordings/:id/download.txt: TXT 다운로드
- GET /api/recordings/:id/download.xlsx: Excel 다운로드

## 데이터 모델

Recording 주요 필드:

- id
- title
- audioUrl
- audioMimeType
- durationSec
- status
- transcriptText
- errorMessage
- createdAt
- updatedAt

## 운영 메모 (Azure VM)

- 앱은 systemd 서비스로 운영 가능
- 환경 변수는 Key Vault에서 조회해 주입 가능
- 배포 시 rsync --delete 사용하면 VM의 런타임 스크립트가 삭제될 수 있으므로 제외 규칙 또는 재생성 단계가 필요

## 문제 해결

- DB 연결 실패: DATABASE_URL 확인, DB 컨테이너/서버 상태 확인
- 업로드 실패: AZURE_STORAGE_CONNECTION_STRING, 컨테이너 권한/존재 여부 확인
- 전사 실패: GROQ_API_KEY 또는 GROQ_API_TOKEN 확인
- 다운로드 실패: 해당 녹음 ID 존재 여부 및 전사 데이터 확인

## 라이선스

별도 명시가 없으면 모든 권리는 저장소 소유자에게 있습니다.
