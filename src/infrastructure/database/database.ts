import { Context } from "effect";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "./schema.ts";

/**
 * 인프라 전용 Drizzle 데이터베이스 서비스.
 *
 * core 도메인·Use Case·Port는 이 서비스를 모른다. TripRoomRepository를
 * PostgreSQL로 이관하는 작업(RAON 이후 티켓)이 이 서비스를 유일한 접점으로 사용한다.
 * 드라이버는 postgres-js 하나만 사용한다(트랜잭션 지원 + Node/엣지 양용).
 */
export class Database extends Context.Service<
  Database,
  {
    readonly db: PostgresJsDatabase<typeof schema>;
  }
>()("galanda/infrastructure/Database") {}
