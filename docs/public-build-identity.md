# 공개 빌드 식별

화면과 API가 서로 다른 버전인지 확인하기 위한 최소 식별 정보다.
사용자 정보, 환경 변수, release tag, 호스트 경로는 공개하지 않는다.

## 프런트엔드

Web/PWA와 AIT 빌드는 HTML에 다음 meta 태그를 넣는다.

- `galanda-build-commit`: 빌드한 checkout의 전체 Git SHA, 확인할 수 없으면 `unknown`
- `galanda-build-state`: `clean`, `dirty`, `unknown`

`dirty`는 커밋하지 않은 tracked 또는 untracked 파일이 있음을 뜻한다.
ignored 파일은 제외하므로 `clean`만으로 환경 설정이나 모든 산출물의 동일성을
증명하지는 않는다. Git 정보가 없거나 다른 저장소 안에 풀어 놓은 소스는 `unknown`이다.

열린 브라우저의 개발자 도구에서 현재 HTML을 확인한다.

```js
Object.fromEntries(
  [...document.querySelectorAll('meta[name^="galanda-build-"]')]
    .map((meta) => [meta.name, meta.content]),
)
```

PWA는 이전 HTML을 계속 사용할 수 있다. 서버에서 새로 받은 HTML의 태그와
현재 열린 페이지의 태그를 구분한다. 태그가 없거나 `dirty` / `unknown`이면
정확한 출시 commit을 확인했다고 기록하지 않는다.

## Worker

`GET /api/version`은 인증이나 DB 연결 없이 다음 형태의 JSON을 반환한다.
응답은 `Cache-Control: no-store`이며 기존 `/api/health` 응답은 바꾸지 않는다.

```json
{ "worker": { "versionId": "<Cloudflare version UUID>" } }
```

이 ID는 요청을 처리한 Worker의 플랫폼 version이며 Git SHA가 아니다.
빌드 commit과 Worker version의 연결은 배포 기록에서 확인한다.
점진 배포 중에는 요청마다 ID가 다를 수 있다. binding이 없거나 ID가 유효하지
않으면 `null`을 반환하며, 이를 배포 버전 확인 성공으로 취급하지 않는다.

binding 정의: [Cloudflare Version metadata](https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/)
