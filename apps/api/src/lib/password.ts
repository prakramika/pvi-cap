import bcrypt from "bcryptjs";

const ROUNDS = 10;
const MIN_LENGTH = 10;

export function assertPasswordPolicy(password: string): void {
  if (password.length < MIN_LENGTH) {
    throw new Error(`Password must be at least ${MIN_LENGTH} characters.`);
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error("Password must include at least one letter and one number.");
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

/** Same cost as real hashes so a missing user does not fail faster than a real one. */
export const dummyPasswordHash = bcrypt.hashSync("not-a-real-password", ROUNDS);
