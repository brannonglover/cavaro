import { verifyAdminSession } from '@/lib/admin-auth';
import { AdminLogin } from './AdminLogin';
import { AdminDashboard } from './AdminDashboard';

export default async function AdminPage() {
  const isAuthed = await verifyAdminSession();

  if (!isAuthed) {
    return <AdminLogin />;
  }

  return <AdminDashboard />;
}
