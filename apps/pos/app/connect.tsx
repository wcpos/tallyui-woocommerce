import { useLocalSearchParams, useRouter } from 'expo-router';
import { ConnectForm } from '../components/connect-form';
import { SavedSites } from '../components/saved-sites';
import { useSession } from '../lib/auth/session-context';

export default function Connect() {
  const { startSignIn, savedSites, signInSaved, startSignInAt, removeSaved, removeSavedSite } = useSession();
  const router = useRouter();
  const { error } = useLocalSearchParams<{ error?: string }>();
  return <ConnectForm startSignIn={startSignIn} signInError={error}
    saved={savedSites.length > 0 ? <SavedSites sites={savedSites}
      onOpenPos={async (home, uuid) => { await signInSaved(home, uuid); router.replace('/catalogue'); }}
      onSignInAt={startSignInAt} onRemoveUser={removeSaved} onRemoveSite={removeSavedSite} /> : null} />;
}
