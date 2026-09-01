import { env } from 'cloudflare:workers';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { ensureDatabase } from '@/lib/d1';

export type AccessUser = {
  userId: string;
  displayName: string;
  email: string;
};

let cachedTeamDomain = '';
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function configuredAdminEmails() {
  const value = env.DAVETLY_ADMIN_EMAILS;
  if (typeof value !== 'string') return new Set<string>();

  return new Set(
    value
      .split(',')
      .map((email) => email.trim().toLocaleLowerCase('en-US'))
      .filter(Boolean),
  );
}

function accessConfiguration() {
  const rawTeamDomain = env.CF_ACCESS_TEAM_DOMAIN?.trim();
  const audience = env.CF_ACCESS_AUD?.trim();
  if (!rawTeamDomain || !audience) return null;

  let teamUrl: URL;
  try {
    teamUrl = new URL(
      rawTeamDomain.startsWith('https://')
        ? rawTeamDomain
        : `https://${rawTeamDomain}`,
    );
  } catch {
    return null;
  }

  if (
    teamUrl.protocol !== 'https:' ||
    teamUrl.username ||
    teamUrl.password ||
    teamUrl.port ||
    teamUrl.pathname !== '/' ||
    teamUrl.search ||
    teamUrl.hash ||
    !teamUrl.hostname.endsWith('.cloudflareaccess.com')
  ) {
    return null;
  }

  return { audience, teamDomain: teamUrl.origin };
}

function accessJwks(teamDomain: string) {
  if (!cachedJwks || cachedTeamDomain !== teamDomain) {
    cachedTeamDomain = teamDomain;
    cachedJwks = createRemoteJWKSet(
      new URL(`${teamDomain}/cdn-cgi/access/certs`),
    );
  }
  return cachedJwks;
}

/**
 * Verifies the Cloudflare Access assertion instead of trusting identity headers.
 * Missing or invalid configuration and assertions deliberately fail closed.
 */
export async function getAccessUser(): Promise<AccessUser | null> {
  const configuration = accessConfiguration();
  if (!configuration) return null;

  const assertion = (await headers()).get('cf-access-jwt-assertion');
  if (!assertion) return null;

  try {
    const { payload } = await jwtVerify(
      assertion,
      accessJwks(configuration.teamDomain),
      {
        algorithms: ['RS256'],
        audience: configuration.audience,
        issuer: configuration.teamDomain,
      },
    );
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      return null;
    }

    const email = payload.email.trim().toLocaleLowerCase('en-US');
    if (!email) return null;
    return {
      userId: `cf-access:${payload.sub}`,
      displayName: email,
      email,
    };
  } catch {
    return null;
  }
}

/**
 * Applies a second, application-side allowlist and reconciles an existing user
 * by normalized email when moving from the previous identity provider.
 */
export async function ensureConfiguredAdmin(
  accessUser: AccessUser,
): Promise<AccessUser | null> {
  const email = accessUser.email.trim().toLocaleLowerCase('en-US');
  if (!configuredAdminEmails().has(email)) return null;

  await ensureDatabase();
  await env.DB.prepare(`INSERT INTO app_users (
      id, email, display_name, role, status
    ) VALUES (?, ?, ?, 'admin', 'active')
    ON CONFLICT(email) DO UPDATE SET
      display_name = excluded.display_name,
      role = 'admin',
      status = 'active'`)
    .bind(accessUser.userId, email, accessUser.displayName)
    .run();

  const account = await env.DB.prepare(`SELECT id FROM app_users
    WHERE email = ? COLLATE NOCASE LIMIT 1`)
    .bind(email)
    .first<{ id: string }>();
  if (!account?.id) return null;

  return { ...accessUser, userId: account.id, email };
}

export async function requireConfiguredAdmin(): Promise<AccessUser> {
  const accessUser = await getAccessUser();
  const admin = accessUser ? await ensureConfiguredAdmin(accessUser) : null;
  if (!admin) redirect('/');
  return admin;
}
