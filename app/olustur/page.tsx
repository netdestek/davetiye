import { InvitationBuilder } from '@/components/invitation-builder';
import { getCurrentUser } from '@/lib/user-auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CreateInvitationPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/giris?returnTo=/olustur');
  return <InvitationBuilder />;
}
