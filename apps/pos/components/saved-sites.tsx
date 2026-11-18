import { useState, type JSX, type KeyboardEvent } from 'react';
import { Platform, Pressable, View, type ViewProps } from 'react-native';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, ChevronDownIcon,
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Avatar, Badge, Button, Card, DropdownMenu,
  DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, IconButton, Text, XIcon } from '@tallyui/components';
import type { SavedSite } from '../lib/auth/roster';
import { SessionExpiredError } from '../lib/auth/session';
import { getNextExpansion } from '../lib/auth/sites-expansion';
import type { StoreSite } from '../lib/auth/site';
import { getInitials } from '../lib/cashier/initials';
import { MoreIcon, PlusIcon, TrashIcon } from './icons';

// v2 wp-users.tsx:24-50: arrows focus and select the next saved user.
const ARROW_STEP: Record<string, 1 | -1> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
const onUsersKeyDown = (event: KeyboardEvent<HTMLElement>) => {
  const step = ARROW_STEP[event.nativeEvent.key];
  const target = event.target as unknown as HTMLElement;
  if (!step || target.getAttribute('role') !== 'radio') return;
  const group = event.currentTarget;
  const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'));
  const index = radios.indexOf(target);
  if (index === -1) return;
  event.preventDefault();
  const next = radios[(index + step + radios.length) % radios.length];
  next.focus();
  next.click();
};
const usersKeys: ViewProps & { onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void } = Platform.OS === 'web'
  ? { onKeyDown: onUsersKeyDown } : {};

export interface SavedSitesProps {
  sites: SavedSite[];
  /** Signs the chosen saved cashier in; rejects with SessionExpiredError when the store refused them. */
  onOpenPos(home: string, uuid: string): Promise<void>;
  /** Starts a sign-in at the store: Add another user and Re-authenticate. */
  onSignInAt(site: StoreSite): void;
  onRemoveUser(home: string, uuid: string): void;
  onRemoveSite(home: string): void;
}

export function SavedSites(props: SavedSitesProps): JSX.Element {
  const [picked, setPicked] = useState<Record<string, string>>({});
  const homes = props.sites.map(saved => saved.site.home);
  const [expansion, setExpansion] = useState(() => getNextExpansion({ homes: [], expanded: undefined }, homes));
  const next = getNextExpansion(expansion, homes);
  if (next !== expansion) setExpansion(next);
  if (props.sites.length === 1) return <View className="w-full gap-5">
    {props.sites.map(saved => <Card key={saved.site.home} testID="saved-site" className="w-full gap-3 p-3">
      <View className="flex-row items-center gap-3">
        <SiteHeader site={saved.site} /><SiteMenu site={saved.site} onRemoveSite={props.onRemoveSite} />
      </View>
      <SiteBody {...props} {...saved} picked={picked[saved.site.home] ?? null}
        onPick={uuid => setPicked(previous => ({ ...previous, [saved.site.home]: uuid }))} />
    </Card>)}
  </View>;
  return <View className="w-full gap-2">
    <Text testID="saved-sites-heading" className="text-sm font-semibold">Your sites</Text>
    <Accordion type="single" collapsible className="gap-2" value={next.expanded ?? ''}
      onValueChange={value => setExpansion(current => ({ ...current, expanded: value }))}>
      {props.sites.map(saved => {
        const home = saved.site.home, n = saved.cashiers.length;
        return <Card key={home} testID="saved-site" className="w-full p-3">
          <AccordionItem value={home} className="border-b-0">
            <View className="flex-row items-center gap-2">
              <View className="min-w-0 flex-1">
              <AccordionTrigger testID="saved-site-trigger" className="min-h-11 justify-start gap-3 py-2 web:hover:no-underline">
                <View className={next.expanded === home ? 'rotate-180' : undefined}>
                  <ChevronDownIcon size={16} strokeWidth={1.5} className="text-muted-foreground" />
                </View>
                <SiteHeader site={saved.site} />
                {n > 0 && <Badge testID="saved-site-users" variant="info" label={`${n} ${n === 1 ? 'user' : 'users'}`} />}
              </AccordionTrigger>
              </View>
              <SiteMenu site={saved.site} onRemoveSite={props.onRemoveSite} />
            </View>
            <AccordionContent><View className="gap-3 pt-2">
              <SiteBody {...props} {...saved} picked={picked[home] ?? null}
                onPick={uuid => setPicked(previous => ({ ...previous, [home]: uuid }))} />
            </View></AccordionContent>
          </AccordionItem>
        </Card>;
      })}
    </Accordion>
  </View>;
}

function SiteBody({ site, cashiers, picked, onPick, onOpenPos, onSignInAt, onRemoveUser }:
  SavedSite & Omit<SavedSitesProps, 'sites' | 'onRemoveSite'> & { picked: string | null; onPick(uuid: string): void }) {
  const [refused, setRefused] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ uuid: string; name: string } | null>(null);
  const selectedUuid = (cashiers.find(cashier => cashier.tokens.user.uuid === picked) ?? cashiers[0]).tokens.user.uuid;
  async function openPos() {
    setBusy(true);
    setError(null);
    try {
      await onOpenPos(site.home, selectedUuid);
    } catch (err) {
      if (err instanceof SessionExpiredError) setRefused(previous => new Set([...previous, selectedUuid]));
      else setError('Could not sign in. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return <>
    <Text className="text-sm font-semibold">WordPress users</Text>
    <Text testID="saved-users-note" className="text-sm text-muted-foreground">Signed-out users stay saved on this device until you remove them.</Text>
    <View role="radiogroup" aria-label="WordPress users" className="gap-2"
      {...usersKeys as ViewProps}>
      {cashiers.map(cashier => {
        const { uuid: u, displayName } = cashier.tokens.user;
        const name = displayName || 'Unknown user', selected = u === selectedUuid, expired = refused.has(u);
        return <View key={u} testID={`saved-user-${u}`} className={'flex-row items-center gap-2 rounded-lg border bg-card pr-2 ' +
          (selected ? 'border-primary bg-muted' : expired ? 'border-warning/40 bg-warning/10' : 'border-border')}>
          <Pressable testID={`saved-user-select-${u}`} role="radio" aria-checked={selected} onPress={() => onPick(u)}
            // v2 wp-user.tsx:195: only the selected radio is a Tab stop.
            tabIndex={selected ? 0 : -1}
            className="min-w-0 flex-1 flex-row items-center gap-3 py-2 pl-3">
            <Avatar size="md" tone="muted" fallback={getInitials(name)} />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-base">{name}</Text>
              <Badge testID={`saved-user-status-${u}`} className="self-start"
                label={expired ? 'Sign in again' : 'Signed in'} variant={expired ? 'warning' : 'success'} />
            </View>
          </Pressable>
          {expired && <Button testID={`saved-user-reauth-${u}`} size="sm" variant="outline"
            onPress={() => onSignInAt(site)}><Text>Re-authenticate</Text></Button>}
          <IconButton testID={`saved-user-remove-${u}`} accessibilityLabel={`Remove ${name}`}
            onPress={() => setRemoving({ uuid: u, name })}><XIcon size={16} /></IconButton>
        </View>;
      })}
    </View>
    <Pressable testID="saved-add-user" role="button" onPress={() => onSignInAt(site)}
      className="min-h-11 w-full flex-row items-center gap-2 rounded-lg border border-dashed border-border bg-transparent px-3 py-2 web:hover:bg-accent active:bg-accent">
      <PlusIcon size={16} strokeWidth={1.5} className="text-muted-foreground" />
      <Text className="text-sm font-medium text-muted-foreground">Add another user</Text>
    </Pressable>
    <Button testID="open-pos-button" size="lg" className="w-full" disabled={busy || refused.has(selectedUuid)}
      onPress={() => void openPos()}><Text>Open POS</Text></Button>
    {error && <Text testID="saved-open-pos-error" className="text-sm text-destructive">{error}</Text>}
    {removing && <AlertDialog open onOpenChange={next => { if (!next) setRemoving(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Remove ${removing.name}`}</AlertDialogTitle>
          <AlertDialogDescription>Are you sure you want to remove this user? Removing a user from the POS will not affect any data on the server.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild onPress={() => setRemoving(null)}>
            <Button variant="outline" testID="saved-user-remove-cancel"><Text>Cancel</Text></Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild onPress={() => { onRemoveUser(site.home, removing.uuid); setRemoving(null); }}>
            <Button variant="destructive" testID="saved-user-remove-confirm"><Text>Remove</Text></Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>}
  </>;
}

function SiteHeader({ site }: { site: StoreSite }) {
  return <>
    <Avatar size="md" tone="muted" fallback={getInitials(site.name || site.home)} className="h-9 w-9 rounded-md" />
    <View className="min-w-0 flex-1 gap-0.5">
      <Text testID="saved-site-name" className="text-base font-semibold">{site.name}</Text>
      <Text testID="saved-site-url" className="text-sm text-muted-foreground">{site.home}</Text>
    </View>
  </>;
}

function SiteMenu({ site, onRemoveSite }: { site: StoreSite; onRemoveSite: SavedSitesProps['onRemoveSite'] }) {
  const [removingSite, setRemovingSite] = useState(false);
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton testID="saved-site-menu" accessibilityLabel="Actions" className="h-11 w-11">
          <MoreIcon size={18} strokeWidth={1.5} className="text-muted-foreground" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem testID="saved-site-remove" className="gap-2" onPress={() => setRemovingSite(true)}>
          <TrashIcon testID="saved-site-remove-icon" size={16} className="text-destructive" />
          <Text className="text-destructive">Remove site</Text>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {removingSite && <AlertDialog open onOpenChange={setRemovingSite}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove site</AlertDialogTitle>
          <AlertDialogDescription>Remove store and associated users?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild onPress={() => setRemovingSite(false)}>
            <Button variant="outline" testID="saved-site-remove-cancel"><Text>Cancel</Text></Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild onPress={() => { onRemoveSite(site.home); setRemovingSite(false); }}>
            <Button variant="destructive" testID="saved-site-remove-confirm"><Text>Remove</Text></Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>}
  </>;
}
