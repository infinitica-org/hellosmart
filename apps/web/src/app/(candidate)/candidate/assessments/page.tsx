import { redirect } from 'next/navigation';
import { ROUTES } from '@/constants/routes';

export default function CandidateAssessmentsPage() {
  redirect(ROUTES.CANDIDATE.DASHBOARD);
}

