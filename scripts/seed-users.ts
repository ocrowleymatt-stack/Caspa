import bcrypt from 'bcrypt';
import { getConfig } from '../src/shared/config';
import { generateId, readCollection, upsert } from '../src/shared/db';

interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: 'admin' | 'user';
  status: 'pending' | 'active' | 'rejected' | 'disabled';
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

const JAMES_EMAIL = 'james@caspa.local';
const JAMES_PASSWORD = 'James2026!';

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function upsertUser(
  users: User[],
  input: {
    email: string;
    password: string;
    displayName: string;
    role: 'admin' | 'user';
    verifiedBy?: string;
  },
): Promise<User> {
  const email = input.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.password);
  const existing = users.find((user) => user.email === email);

  const user: User = existing
    ? {
        ...existing,
        passwordHash,
        displayName: input.displayName,
        role: input.role,
        status: 'active',
        updatedAt: now,
        verifiedAt: existing.verifiedAt ?? now,
        verifiedBy: existing.verifiedBy ?? input.verifiedBy,
      }
    : {
        id: generateId(),
        email,
        passwordHash,
        displayName: input.displayName,
        role: input.role,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        verifiedAt: input.role === 'user' ? now : undefined,
        verifiedBy: input.verifiedBy,
      };

  await upsert('users', user);
  console.log(`${existing ? 'Updated' : 'Created'} ${input.role}: ${email}`);
  return user;
}

async function main(): Promise<void> {
  const { adminEmail, adminPassword } = getConfig();
  const adminEmailNorm = (adminEmail ?? 'admin@caspa.local').trim().toLowerCase();
  const adminPasswordValue = adminPassword ?? 'changeme';

  const users = await readCollection<User>('users');

  const primaryAdmin = await upsertUser(users, {
    email: adminEmailNorm,
    password: adminPasswordValue,
    displayName: 'Administrator',
    role: 'admin',
  });

  // Secondary admin — matches common local .env so production login works with either account
  const mattEmail = (process.env.MATTHEW_EMAIL ?? 'matthew@ocrowley.com').trim().toLowerCase();
  const mattPassword = process.env.MATTHEW_PASSWORD ?? adminPasswordValue;
  if (mattEmail !== adminEmailNorm) {
    await upsertUser(await readCollection<User>('users'), {
      email: mattEmail,
      password: mattPassword,
      displayName: 'Matthew',
      role: 'admin',
    });
  }

  await upsertUser(await readCollection<User>('users'), {
    email: JAMES_EMAIL,
    password: JAMES_PASSWORD,
    displayName: 'James',
    role: 'user',
    verifiedBy: primaryAdmin.id,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
