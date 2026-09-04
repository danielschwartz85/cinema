import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users } from '../db/schema';
import { env } from '../config/env';
import { AppError } from '../types/AppError';

export async function login(username: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.username, username));
  if (!user) throw AppError.unauthorized('Invalid username or password.');

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) throw AppError.unauthorized('Invalid username or password.');

  const token = jwt.sign({ id: user.id, username: user.username }, env.JWT_SECRET, {
    expiresIn: '12h',
  });

  return { token, user: { id: user.id, username: user.username } };
}
