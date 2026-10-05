import { Redirect } from 'expo-router';
import { useSession } from '../lib/auth/session-context';

export default function Index() {
  const { session, ready } = useSession();
  if (!ready) return null;
  return <Redirect href={session ? '/catalogue' : '/connect'} />;
}
