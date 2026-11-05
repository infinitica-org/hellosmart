import { redirect } from 'next/navigation';
import { ROUTES } from '@/constants/routes';

export default function CandidateDashboardAliasPage() {
  redirect(ROUTES.CANDIDATE.DASHBOARD);
}

