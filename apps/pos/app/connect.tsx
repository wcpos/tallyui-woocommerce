import { useLocalSearchParams } from 'expo-router';
import { ConnectForm } from '../components/connect-form';
import { useSession } from '../lib/auth/session-context';

export default function Connect() {
  const { startSignIn } = useSession();
  const { error } = useLocalSearchParams<{ error?: string }>();
  return <ConnectForm startSignIn={startSignIn} signInError={error} />;
}
