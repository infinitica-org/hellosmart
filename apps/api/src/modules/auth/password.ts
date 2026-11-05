import { hash, verify } from '@node-rs/argon2';

/** S0-T03-1: Argon2id parameters from Sprint 0 ticket. */
export const ARGON2_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

let dummyHashPromise: Promise<string> | null = null;

/** Constant-time mitigation when the email is unknown. */
export async function verifyWithDummyTiming(password: string): Promise<boolean> {
  if (!dummyHashPromise) {
    dummyHashPromise = hash('hs-timing-mitigation-dummy', ARGON2_OPTIONS);
  }
  const dummyHash = await dummyHashPromise;
  await verify(dummyHash, password);
  return false;
}

export async function verifyPassword(hashValue: string, password: string): Promise<boolean> {
  try {
    return await verify(hashValue, password);
  } catch {
    return false;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}
