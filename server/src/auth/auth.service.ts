import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../db/prismaClient";
import { env } from "../config/env";

const SALT_ROUNDS = 10;

export interface TokenPayload {
  userId: string;
  email: string;
}

export class AuthError extends Error {}

export async function registerUser(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AuthError("Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
  });

  return sanitizeUser(user);
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AuthError("Invalid credentials");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AuthError("Invalid credentials");
  }

  const tokens = generateTokens({ userId: user.id, email: user.email });
  return { user: sanitizeUser(user), ...tokens };
}

export function generateTokens(payload: TokenPayload) {
  const accessToken = jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.accessTokenTtl,
  } as jwt.SignOptions);
  const refreshToken = jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.refreshTokenTtl,
  } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as TokenPayload;
}

export async function refreshTokens(refreshToken: string) {
  let payload: TokenPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthError("Invalid or expired refresh token");
  }
  return generateTokens({ userId: payload.userId, email: payload.email });
}

function sanitizeUser(user: { id: string; email: string; name: string }) {
  return { id: user.id, email: user.email, name: user.name };
}
