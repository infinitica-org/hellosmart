import { redirect } from 'next/navigation';

/**
 * Canonical redirect from legacy /admin/organizations to /admin/companies (S1B-T05-1).
 * Eliminates route discrepancies with zero competing UI implementations.
 */
export default function AdminOrganizationsRedirectPage() {
  redirect('/admin/companies');
}

