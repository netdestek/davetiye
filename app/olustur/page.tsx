import { chatGPTSignInPath, getChatGPTUser } from '@/app/chatgpt-auth';
import { InvitationBuilder } from '@/components/invitation-builder';

export const dynamic = 'force-dynamic';

export default async function CreateInvitationPage() {
  const user = await getChatGPTUser();
  return (
    <InvitationBuilder
      isSignedIn={Boolean(user)}
      displayName={user?.displayName ?? null}
      signInPath={chatGPTSignInPath('/olustur')}
    />
  );
}
