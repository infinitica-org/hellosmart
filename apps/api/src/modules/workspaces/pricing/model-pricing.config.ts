import type { ModelPriceEntry, ModelSpendBreakdown } from '../workspace-telemetry.types.js';

export const CURRENT_PRICING_VERSION = 'v1';

/**
 * Pinned model pricing matrix.
 * CRITICAL NOTE: Values from Ticket 9.4 (e.g. GPT-4o $5/$15 per million) are PLACEHOLDERS
 * and must not be presented as real production pricing.
 */
export const MODEL_PRICING_MATRIX: Record<string, ModelPriceEntry> = {
  'gpt-4o': {
    model: 'gpt-4o',
    inputPricePerMillionUsd: '5.00',
    outputPricePerMillionUsd: '15.00',
    inputPricePerMillionMicro: 5_000_000n, // $5.00 in micro-dollars ($1 = 1,000,000 micro-dollars)
    outputPricePerMillionMicro: 15_000_000n, // $15.00 in micro-dollars
    isPlaceholder: true,
  },
  'test-cheap-model': {
    model: 'test-cheap-model',
    inputPricePerMillionUsd: '1.00',
    outputPricePerMillionUsd: '2.00',
    inputPricePerMillionMicro: 1_000_000n,
    outputPricePerMillionMicro: 2_000_000n,
    isPlaceholder: false,
  },
  'test-expensive-model': {
    model: 'test-expensive-model',
    inputPricePerMillionUsd: '100.00',
    outputPricePerMillionUsd: '200.00',
    inputPricePerMillionMicro: 100_000_000n,
    outputPricePerMillionMicro: 200_000_000n,
    isPlaceholder: false,
  },
};

/**
 * Computes spend in integer micro-dollars from token count and micro-dollar price per million tokens.
 * Single money path: pure integer micro-dollars ($1 = 1,000,000 micro-dollars) via BigInt.
 * Uses integer round-half-up per model direction:
 * microDollars = (tokens * pricePerMillionMicro + 500_000n) / 1_000_000n
 * ZERO floating-point operations.
 */
export function computeTokenCostMicroDollars(tokens: bigint, pricePerMillionMicro: bigint): bigint {
  if (tokens <= 0n || pricePerMillionMicro <= 0n) {
    return 0n;
  }
  return (tokens * pricePerMillionMicro + 500_000n) / 1_000_000n;
}

/**
 * Formats integer micro-dollars ($1 = 1,000,000 micro-dollars) into a fixed-scale decimal string with 6 decimal places.
 * Example: 1234567n micro-dollars -> "1.234567"
 */
export function formatMicroDollarsToUsd(microDollars: bigint): string {
  if (microDollars <= 0n) {
    return '0.000000';
  }
  const dollars = microDollars / 1_000_000n;
  const fractional = (microDollars % 1_000_000n).toString().padStart(6, '0');
  return `${dollars.toString()}.${fractional}`;
}

/**
 * Builds an itemized model spend breakdown for a given model and token counts.
 * If model is unpriced/unknown: cost is 0, input/output prices recorded as "0.00", tokens preserved.
 */
export function calculateModelBreakdown(
  model: string,
  promptTokens: bigint,
  completionTokens: bigint,
): { breakdown: ModelSpendBreakdown; isUnknown: boolean } {
  const price = MODEL_PRICING_MATRIX[model];
  if (!price) {
    return {
      breakdown: {
        model,
        promptTokens: promptTokens.toString(),
        completionTokens: completionTokens.toString(),
        inputPricePerMillion: '0.00',
        outputPricePerMillion: '0.00',
        promptCostMicroDollars: '0',
        completionCostMicroDollars: '0',
        totalCostMicroDollars: '0',
        totalCostUsd: '0.000000',
      },
      isUnknown: true,
    };
  }

  const promptMicro = computeTokenCostMicroDollars(promptTokens, price.inputPricePerMillionMicro);
  const completionMicro = computeTokenCostMicroDollars(
    completionTokens,
    price.outputPricePerMillionMicro,
  );
  const totalMicro = promptMicro + completionMicro;

  return {
    breakdown: {
      model,
      promptTokens: promptTokens.toString(),
      completionTokens: completionTokens.toString(),
      inputPricePerMillion: price.inputPricePerMillionUsd,
      outputPricePerMillion: price.outputPricePerMillionUsd,
      promptCostMicroDollars: promptMicro.toString(),
      completionCostMicroDollars: completionMicro.toString(),
      totalCostMicroDollars: totalMicro.toString(),
      totalCostUsd: formatMicroDollarsToUsd(totalMicro),
    },
    isUnknown: false,
  };
}
