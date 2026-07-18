import { Request, Response } from "express";
import { z } from "zod";
import {
  registerUser,
  loginUser,
  refreshTokens,
  AuthError,
} from "./auth.service";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const user = await registerUser(
      parsed.data.email,
      parsed.data.password,
      parsed.data.name
    );
    return res.status(201).json({ user });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = await loginUser(parsed.data.email, parsed.data.password);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(401).json({ error: err.message });
    }
    throw err;
  }
}

export async function refresh(req: Request, res: Response) {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const tokens = await refreshTokens(parsed.data.refreshToken);
    return res.status(200).json(tokens);
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(401).json({ error: err.message });
    }
    throw err;
  }
}
