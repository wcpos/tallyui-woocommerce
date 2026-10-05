import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Redirect, type Href } from 'expo-router';
import { Text } from '@tallyui/components';
import { LoginError } from '../../lib/auth/login';
import { useSession } from '../../lib/auth/session-context';

export default function Callback() {
  const { completeSignIn } = useSession();
  const handled = useRef(false);
  const [search] = useState(() => window.location.search);
  const [target, setTarget] = useState<Href | null>(null);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    try {
      completeSignIn(search);
      setTarget('/catalogue');
    } catch (error) {
      setTarget({ pathname: '/connect', params: { error: error instanceof LoginError ? error.code : 'unknown' } });
    }
  }, [completeSignIn, search]);
  if (target) return <Redirect href={target} />;
  return (
    <View className="flex-1 items-center justify-center bg-background p-6 gap-4">
      <Text>Signing in…</Text>
    </View>
  );
}
