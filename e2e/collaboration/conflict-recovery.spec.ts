import { test, expect } from "@playwright/test";
import { createAuthenticatedContext, HOST_USER } from "../fixtures/auth.ts";
import { createTrip, publishablePlan } from "../fixtures/trip.ts";

test.describe("CAS Conflict & Draft Recovery E2E", () => {
  test("동시 편집 시 409 충돌을 감지하고 로컬 드래프트를 보존하며 최신 revision으로 복구한다", async ({ browser, baseURL }) => {
    const origin = baseURL || "http://localhost:5173";
    const userA = await createAuthenticatedContext(browser, HOST_USER, origin);
    const userB = await createAuthenticatedContext(browser, HOST_USER, origin);

    try {
      // 1. 방 생성
      const tripId = await createTrip(userA.page, origin, "충돌 복구 검증 여행");
      const initialPlanResponse = await userA.context.request.post(
        `${origin}/api/trips/${tripId}/plans`,
        {
          data: {
            title: "충돌 기준 여행안",
            proposalReason: "동시 편집 기준값",
            ...publishablePlan,
            expectedRevision: 1,
          },
        },
      );
      expect(initialPlanResponse.status()).toBe(201);
      const initialRoom = (await initialPlanResponse.json()) as {
        revision: number;
        plans: ReadonlyArray<{ id: string; title: string }>;
      };
      const initialPlan = initialRoom.plans.at(-1);
      expect(initialPlan).toBeDefined();

      const editPath = `/trips/${tripId}/plans/${initialPlan!.id}/edit`;
      await Promise.all([
        userA.page.goto(`${origin}${editPath}`),
        userB.page.goto(`${origin}${editPath}`),
      ]);
      await expect(userA.page.getByText("여행안 구성")).toBeVisible();
      await expect(userB.page.getByText("여행안 구성")).toBeVisible();

      const [roomAResponse, roomBResponse] = await Promise.all([
        userA.context.request.get(`${origin}/api/trips/${tripId}`),
        userB.context.request.get(`${origin}/api/trips/${tripId}`),
      ]);
      const [roomA, roomB] = await Promise.all([
        roomAResponse.json() as Promise<{ revision: number }>,
        roomBResponse.json() as Promise<{ revision: number }>,
      ]);
      expect(roomA.revision).toBe(2);
      expect(roomB.revision).toBe(roomA.revision);

      // 2. 같은 revision의 실제 편집 form에 서로 다른 제목을 보관
      await userA.page.getByRole("button", { name: /기본 정보/ }).click();
      await userB.page.getByRole("button", { name: /기본 정보/ }).click();
      await userA.page.getByLabel("여행안 제목 *").fill("A 먼저 저장");
      await userB.page.getByLabel("여행안 제목 *").fill("B 로컬 초안");
      await userA.page.getByRole("button", { name: "편집 완료" }).click();
      await userB.page.getByRole("button", { name: "편집 완료" }).click();

      // 3. A 저장 성공으로 revision을 올린다.
      const saveA = userA.page.waitForResponse((response) => {
        const request = response.request();
        return (
          request.method() === "PATCH" &&
          new URL(request.url()).pathname ===
            `/api/trips/${tripId}/plans/${initialPlan!.id}`
        );
      });
      await userA.page.getByRole("button", { name: "수정안 반영하기" }).click();
      const savedA = await saveA;
      expect(savedA.status()).toBe(200);
      const roomAfterA = (await savedA.json()) as {
        revision: number;
        plans: ReadonlyArray<{ id: string; title: string }>;
      };
      expect(roomAfterA.revision).toBe(3);
      expect(roomAfterA.plans.find((plan) => plan.id === initialPlan!.id)?.title).toBe(
        "A 먼저 저장",
      );

      // 4. B의 stale write는 실제 409가 되고, 작성 중인 값을 보존한다.
      const saveBConflict = userB.page.waitForResponse((response) => {
        const request = response.request();
        return (
          request.method() === "PATCH" &&
          new URL(request.url()).pathname ===
            `/api/trips/${tripId}/plans/${initialPlan!.id}`
        );
      });
      await userB.page.getByRole("button", { name: "수정안 반영하기" }).click();
      const conflictedB = await saveBConflict;
      expect(conflictedB.status()).toBe(409);
      await expect(userB.page.getByRole("alert")).toContainText("최신");
      await userB.page.getByRole("button", { name: "내 변경 다시 적용" }).click();
      await userB.page.getByRole("button", { name: /기본 정보/ }).click();
      await expect(userB.page.getByLabel("여행안 제목 *")).toHaveValue("B 로컬 초안");
      await userB.page.getByRole("button", { name: "편집 완료" }).click();

      const saveBAfterRebase = userB.page.waitForResponse((response) => {
        const request = response.request();
        return (
          request.method() === "PATCH" &&
          new URL(request.url()).pathname ===
            `/api/trips/${tripId}/plans/${initialPlan!.id}`
        );
      });
      await userB.page.getByRole("button", { name: "수정안 반영하기" }).click();
      const savedB = await saveBAfterRebase;
      expect(savedB.status()).toBe(200);
      const roomAfterB = (await savedB.json()) as {
        revision: number;
        plans: ReadonlyArray<{ id: string; title: string }>;
      };
      expect(roomAfterB.revision).toBe(4);
      expect(roomAfterB.plans.find((plan) => plan.id === initialPlan!.id)?.title).toBe(
        "B 로컬 초안",
      );
    } finally {
      await userA.context.close();
      await userB.context.close();
    }
  });
});
