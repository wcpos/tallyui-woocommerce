import { Redirect, useRouter } from 'expo-router';
import { SupportScreen } from '../components/support-screen';
import { useSession } from '../lib/auth/session-context';

// v2 (drawer)/support: the page needs a session, not the catalogue.
export default function Support() {
  const { session, ready } = useSession();
  const router = useRouter();
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  return <SupportScreen onBack={() => { router.canGoBack() ? router.back() : router.replace('/catalogue'); }} />;
}
