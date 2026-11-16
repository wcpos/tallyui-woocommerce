import { View } from 'react-native';
import { Button, Text } from '@tallyui/components';

/** WCPOS v2's EmptyState (screens/main/components/list-frame): a list's "nothing here" message, with an optional
 *  line under the title and an optional action such as Clear filters. */
export function EmptyState({ title, description, action }: {
  title: string; description?: string; action?: { label: string; onPress(): void };
}) {
  return (
    <View testID="no-data-message" className="flex-1 items-center justify-center gap-2 p-6">
      <Text testID="no-data-message-title" className="text-center font-medium text-foreground">{title}</Text>
      {description ? <Text testID="no-data-message-description" className="text-center text-muted-foreground">{description}</Text> : null}
      {action ? <Button testID="no-data-message-action" variant="ghost" size="sm" onPress={action.onPress}><Text>{action.label}</Text></Button> : null}
    </View>
  );
}
