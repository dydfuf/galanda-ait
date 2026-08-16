import { Effect, Schema } from "effect";

export const ExpenseItemSchema = Schema.Struct({
  payerId: Schema.String,
  amount: Schema.Number,
  involvedMemberIds: Schema.Array(Schema.String),
});
export type ExpenseItem = typeof ExpenseItemSchema.Type;

export interface SettlementBalance {
  readonly userId: string;
  readonly netAmount: number; // 양수: 받아야 할 금액, 음수: 보내야 할 금액
}

/**
 * 정산 금액 계산 (Effect 도메인 계산 함수)
 */
export const calculateSettlement = (
  expenses: ReadonlyArray<ExpenseItem>
): Effect.Effect<ReadonlyArray<SettlementBalance>, never, never> =>
  Effect.sync(() => {
    const balances = new Map<string, number>();

    for (const exp of expenses) {
      if (exp.involvedMemberIds.length === 0) continue;
      const splitAmount = exp.amount / exp.involvedMemberIds.length;

      balances.set(exp.payerId, (balances.get(exp.payerId) ?? 0) + exp.amount);
      for (const memberId of exp.involvedMemberIds) {
        balances.set(memberId, (balances.get(memberId) ?? 0) - splitAmount);
      }
    }

    return Array.from(balances.entries()).map(([userId, netAmount]) => ({
      userId,
      netAmount: Math.round(netAmount),
    }));
  });
