import type { Effect } from "effect";
import type { RepositoryError } from "../domain/errors.ts";

/**
 * 저장소 포트 공통 반환 타입
 * - 성공 시 A 반환
 * - 인프라 장애 발생 시 RepositoryError 기본 포함
 * - 메서드별 비즈니스 오류(NotFoundError, RevisionConflictError 등)는 E로 추가
 */
export type RepositoryEffect<A, E = never> = Effect.Effect<
  A,
  E | RepositoryError
>;
