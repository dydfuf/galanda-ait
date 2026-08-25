# RAON-204 database role rollout

실제 password, secret, 전체 connection URL은 이 문서나 명령 인자에 기록하지 않는다.

## 적용

1. Supabase Data API가 disabled인지 Dashboard에서 확인한다.
2. 관리자 전용 `DATABASE_URL`로 `pnpm db:migrate`를 실행한다.
3. 같은 관리자 연결로 권한 검증을 실행한다.

   ```bash
   psql "$DATABASE_URL" -f scripts/verify-database-privileges.sql
   ```

4. 대화형 `psql`에서 runtime password를 설정하고 로그인을 활성화한다. `\password`는 password를 화면이나 shell history에 남기지 않는다.

   ```sql
   \password galanda_worker
   ALTER ROLE galanda_worker LOGIN;
   ```

5. Cloudflare Dashboard에서 `galanda-staging` Hyperdrive origin user를 `galanda_worker`로 바꾸고 새 password를 입력한다. host, port, database, TLS 설정과 query caching disabled 상태는 유지한다.
   password 변경 직후 Cloudflare가 `2013 Invalid database credentials`를 반환하면 Supabase credential 반영을 잠시 기다린 뒤 같은 값으로 재시도한다. 기존 Hyperdrive 설정은 검증 성공 전까지 유지된다.
6. Hyperdrive connection pool을 재시작해 기존 관리자 연결을 drain한다. 재시작 중 in-flight query는 잠깐 실패할 수 있으므로 staging traffic이 없을 때 수행한다.
7. secret을 출력하지 않는 아래 명령으로 origin user와 caching 상태를 확인한다.

   ```bash
   npx wrangler hyperdrive get 36428926fddb413e82914434280e3ffc
   ```

8. staging에서 Better Auth sign-up/session/sign-out, Trip create/list/detail/update, Plan/opinion/confirm/join, stale revision 409, `GET /api/health`를 확인한다.
9. 전환 검증 후 Supabase 관리자 password를 회전한다. 새 관리자 credential은 migration 환경에만 보관하고 Worker/Hyperdrive에는 넣지 않는다.

## Rollback

1. Cloudflare Dashboard에서 Hyperdrive origin credential을 기존 관리자 계정으로 되돌린다.
2. Hyperdrive connection pool을 재시작하고 staging smoke를 다시 수행한다.
3. 필요하면 관리자 연결에서 `ALTER ROLE galanda_worker NOLOGIN;`을 실행한다.

공개 API 역할의 회수된 권한은 rollback하지 않는다. 애플리케이션이 사용하지 않으며 Data API 재활성화 시 방어선으로 남겨야 한다.
