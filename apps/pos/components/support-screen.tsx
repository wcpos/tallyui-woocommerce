// v2's Support page (WCPOS monorepo packages/core/src/screens/main/support/index.tsx): `screen-support`, the
// ManagementBar titled "Support" (`support-bar`), and the padded `support-frame`. v2's frame holds a Discord embed;
// here it holds the links below, each a DocsLink with its help line under it.
import type { JSX } from 'react';
import { View } from 'react-native';
import { Text } from '@tallyui/components';
import { AreaToolbar, useAreaGutter } from './area-header';
import { DocsLink } from './docs-link';
import { SETTINGS_HELP_CLASS } from './settings/settings-form';

// Desk ruling 2026-11-18: two links only; the community channel is Paul's call. A third link is one entry here.
export const SUPPORT_LINKS: readonly { id: string; label: string; href: string; description: string }[] = [
  { id: 'issues', label: 'Report a problem', href: 'https://github.com/wcpos/tallyui-woocommerce/issues', description: 'Open an issue on GitHub. Say what you did and what you saw.' },
  { id: 'docs', label: 'Read the docs', href: 'https://github.com/wcpos/tallyui-woocommerce#readme', description: 'Setup, supported stores and features.' },
];

export function SupportScreen({ onBack }: { onBack(): void }): JSX.Element {
  const gutter = useAreaGutter();
  return (
    <View testID="screen-support" className="flex-1 bg-background">
      <AreaToolbar area="support" title="Support" onBack={onBack} controls="phone" />
      <View testID="support-frame" className={`min-h-0 flex-1 gap-4 py-3 ${gutter}`}>
        {SUPPORT_LINKS.map(link => <View key={link.id} testID={`support-row-${link.id}`} className="gap-0.5">
          <DocsLink testID={`support-link-${link.id}`} href={link.href}>{link.label}</DocsLink>
          <Text testID={`support-description-${link.id}`} className={SETTINGS_HELP_CLASS}>{link.description}</Text>
        </View>)}
      </View>
    </View>
  );
}
