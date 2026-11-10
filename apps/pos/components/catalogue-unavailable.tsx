// The till's centred notice while the catalogue is connecting or failed to start; Sign out gives a refused user a way out.
import { View } from 'react-native';
import { Button, Text } from '@tallyui/components';

export function CatalogueUnavailable({ message, onSignOut }: { message: string; onSignOut?: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background p-6">
      <Text className="text-center text-foreground">{message}</Text>
      {onSignOut ? <Button variant="outline" testID="catalogue-error-sign-out" onPress={onSignOut}><Text>Sign out</Text></Button> : null}
    </View>
  );
}
