export type LoginPortal = 'admin' | 'company' | 'candidate';

export interface LoginIdentifyResult {
  recognized: boolean;
  role?: string;
  portal?: LoginPortal;
  name?: string;
  orgName?: string | null;
  mfaRequired?: boolean;
  accountStatus?: 'active' | 'suspended';
}

export function portalSignInMeta(portal: LoginPortal): { title: string; description: string } {
  switch (portal) {
    case 'admin':
      return {
        title: 'Platform admin console',
        description: 'Manage organizations, templates, entitlements, and platform operations.',
      };
    case 'company':
      return {
        title: 'Company portal',
        description: 'Configure assessments, invite candidates, and review submissions.',
      };
    case 'candidate':
      return {
        title: 'Candidate workspace',
        description: 'View assigned tasks, connect to your workspace, and submit work.',
      };
  }
}

export function describeSignInStep(identify: LoginIdentifyResult | null): {
  title: string;
  description: string;
} {
  if (identify?.recognized && identify.portal) {
    const meta = portalSignInMeta(identify.portal);
    const who = identify.name ? `${identify.name}` : identify.orgName ? identify.orgName : null;
    return {
      title: meta.title,
      description: who ? `${meta.description} Signing in as ${who}.` : meta.description,
    };
  }
  return {
    title: 'Enter your password',
    description: 'Use the password for your HelloSmart account.',
  };
}
