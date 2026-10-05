import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Button, Card, CardContent, CardHeader, CardTitle, Text } from '@tallyui/components';
import { useSession } from '../lib/auth/session-context';

export default function Catalogue() {
  const { session, ready, signOut } = useSession();
  const router = useRouter();
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>{session.site.name}</CardTitle></CardHeader>
        <CardContent className="gap-4">
          <Text>{`Signed in as ${session.tokens.user.displayName}`}</Text>
          <Button onPress={() => { signOut(); router.replace('/connect'); }}><Text>Sign out</Text></Button>
        </CardContent>
      </Card>
    </View>
  );
}
