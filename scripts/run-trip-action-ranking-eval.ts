import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { unstable_dev } from "wrangler";

interface ModelPrice {
  readonly inputUsdPerMillionTokens: number;
  readonly outputUsdPerMillionTokens: number;
}

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const positiveInteger = (name: string): number => {
  const value = Number(required(name));
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
};

const pricesFor = (
  models: ReadonlyArray<string>
): Readonly<Record<string, ModelPrice>> => {
  const parsed: unknown = JSON.parse(required("AI_EVAL_PRICING_JSON"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI_EVAL_PRICING_JSON must be an object");
  }

  const prices: Record<string, ModelPrice> = {};
  for (const model of models) {
    const price = (parsed as Record<string, unknown>)[model];
    if (!price || typeof price !== "object" || Array.isArray(price)) {
      throw new Error(`Missing pricing for ${model}`);
    }
    const inputUsdPerMillionTokens = Number(
      (price as Record<string, unknown>).inputUsdPerMillionTokens
    );
    const outputUsdPerMillionTokens = Number(
      (price as Record<string, unknown>).outputUsdPerMillionTokens
    );
    if (
      !Number.isFinite(inputUsdPerMillionTokens) ||
      inputUsdPerMillionTokens < 0 ||
      !Number.isFinite(outputUsdPerMillionTokens) ||
      outputUsdPerMillionTokens < 0
    ) {
      throw new Error(`Invalid pricing for ${model}`);
    }
    prices[model] = {
      inputUsdPerMillionTokens,
      outputUsdPerMillionTokens,
    };
  }
  return prices;
};

const main = async () => {
  const models = [...new Set(
    required("AI_EVAL_MODELS").split(",").map((model) => model.trim()).filter(Boolean)
  )];
  if (models.length < 2) {
    throw new Error("AI_EVAL_MODELS must contain at least two unique models");
  }
  const prices = pricesFor(models);
  const gatewayId = required("AI_GATEWAY_ID");
  const policyVersion = required("AI_RECOMMENDATION_POLICY_VERSION");
  const timeoutMs = positiveInteger("AI_RECOMMENDATION_TIMEOUT_MS");
  const directory = await mkdtemp(join(tmpdir(), "galanda-ranking-eval-"));
  let worker: Awaited<ReturnType<typeof unstable_dev>> | undefined;
  try {
    const config = join(directory, "wrangler.json");
    await writeFile(config, JSON.stringify({
      name: "galanda-ranking-eval",
      compatibility_date: "2026-09-15",
      ai: { binding: "AI" },
      observability: { enabled: false },
      vars: {
        AI_GATEWAY_ID: gatewayId,
        AI_RECOMMENDATION_POLICY_VERSION: policyVersion,
        AI_RECOMMENDATION_TIMEOUT_MS: timeoutMs,
        AI_EVAL_MODELS: models,
        AI_EVAL_PRICING: prices,
      },
    }));
    worker = await unstable_dev(fileURLToPath(new URL(
      "../worker/infrastructure/ai/trip-action-ranking-eval-worker.ts",
      import.meta.url,
    )), {
      config,
      local: false,
      port: 0,
      logLevel: "error",
      experimental: { disableExperimentalWarning: true, watch: false },
    });
    const response = await worker.fetch();
    if (!response.ok) throw new Error(`Ranking evaluation failed: HTTP ${response.status}`);
    const report: unknown = await response.json();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    try {
      await worker?.stop();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
