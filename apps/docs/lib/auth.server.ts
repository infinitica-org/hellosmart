import { TeamRole } from './auth';

export interface AuthResult {
  role: TeamRole;
  defaultRedirect: string;
}

// Server-only credential verification. Passwords are never sent to or bundled in client code.
export function verifyPasswordServer(password: string): AuthResult | null {
  const trimmed = password.trim();
  if (!trimmed) return null;

  // Master passkey (env or default)
  const masterPass = process.env.DOCS_PASSWORD || process.env.SITE_PASSWORD || 'hs-master-2026';
  if (trimmed === masterPass) {
    return {
      role: 'master',
      defaultRedirect: '/docs',
    };
  }

  // Team-specific credentials mapping to role and default role playbook
  const roleMap: Record<Exclude<TeamRole, 'master'>, { pass: string; redirect: string }> = {
    sde: {
      pass: process.env.SDE_PASSWORD || 'hs-sde-2026',
      redirect: '/docs/roles/sde',
    },
    ai: {
      pass: process.env.AI_PASSWORD || 'hs-ai-2026',
      redirect: '/docs/roles/ai',
    },
    qa: {
      pass: process.env.QA_PASSWORD || 'hs-qa-2026',
      redirect: '/docs/roles/qa',
    },
    mgmt: {
      pass: process.env.MGMT_PASSWORD || 'hs-mgmt-2026',
      redirect: '/docs/roles/managing',
    },
  };

  for (const [roleKey, conf] of Object.entries(roleMap)) {
    if (trimmed === conf.pass) {
      return {
        role: roleKey as TeamRole,
        defaultRedirect: conf.redirect,
      };
    }
  }

  return null;
}
