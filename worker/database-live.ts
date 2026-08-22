import { Effect, Layer } from "effect";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { Database } from "../src/infrastructure/database/database.ts";
import * as schema from "../src/infrastructure/database/schema.ts";
import { DatabaseConfigurationError } from "../src/infrastructure/errors.ts";

export interface DatabaseEnv {
  /** 서버 전용 자격 증명. VITE_*로 클라이언트 번들에 노출해서는 안 된다. */
  readonly DATABASE_URL?: string;
}

export interface MakeDatabaseLiveOptions {
  readonly maxConnections?: number;
  readonly idleTimeoutSeconds?: number;
  readonly connectTimeoutSeconds?: number;
}

/**
 * Worker용 DatabaseLive 레이어.
 *
 * - 자격 증명은 Cloudflare Worker env(secrets)에서만 주입된다.
 * - postgres-js는 첫 쿼리까지 접속을 열지 않으므로 구성은 fail-fast 검증만 수행한다.
 * - 레이어 종료 시 연결 풀을 정리한다.
 *
 * 드라이버 결정(postgres-js 단일 선택):
 * - 리비전 CAS는 단일 UPDATE 문으로 원자적이라 대화형 트랜잭션이 필수는 아니지만,
 *   스키마가 정규화되어 다중 문장 원자성이 필요해질 경우를 위해 트랜잭션을 지원하는
 *   드라이버 하나만 선택한다.
 * - `pg`(node-postgres)는 CJS 기반이며 Hyperdrive 바인딩 전제에 무겁고,
 *   neon-* 드라이버는 특정 공급자 종속(neon-http는 트랜잭션 미지원)이라 배제했다.
 * - postgres-js는 ESM 네이티브로 Node 24(개발·테스트·마이그레이션)와 엣지 런타임
 *   양쪽에서 동작하고 `db.transaction`을 지원한다.
 */
export const makeDatabaseLive = (
  url: string | undefined,
  options: MakeDatabaseLiveOptions = {}
): Layer.Layer<Database, DatabaseConfigurationError> =>
  Layer.effect(
    Database,
    Effect.gen(function* () {
      if (url === undefined || url.trim() === "") {
        return yield* Effect.fail(
          new DatabaseConfigurationError({
            message:
              "Database configuration is missing: DATABASE_URL is required.",
          })
        );
      }

      const sql = postgres(url, {
        // 커넥션 풀러(PgBouncer 등) 뒤에서 안전하도록 준비된 문을 비활성화한다.
        prepare: false,
        max: options.maxConnections ?? 5,
        idle_timeout: options.idleTimeoutSeconds ?? 20,
        connect_timeout: options.connectTimeoutSeconds ?? 10,
      });

      yield* Effect.addFinalizer(() =>
        Effect.promise(() => sql.end({ timeout: 5 }))
      );

      return { db: drizzle(sql, { schema }) };
    })
  );
