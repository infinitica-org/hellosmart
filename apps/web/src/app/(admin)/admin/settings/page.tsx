import { redirect } from 'next/navigation';
import { ROUTES } from '@/constants';

export default function AdminSettingsPage() {
  redirect(ROUTES.ADMIN.SECURITY);
}
