import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { ConnectorUnauthorizedError, CustomerServiceError } from '@tallyui/core';
import type { Customer } from '@tallyui/core';
import { Button, SearchInput, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Text } from '@tallyui/components';
import type { CustomerSource } from '../lib/customers/customer-source';

// v2's QuerySearchInput debounce (packages/core/src/screens/main/components/query-search-input.tsx:33).
const SEARCH_DEBOUNCE_MS = 250;
// The customer picker's floor (components/customer-picker.tsx:46); the store search is online.
const MIN_QUERY_CHARS = 2;
const COLUMNS = ['Name', 'Email', 'Phone', 'Company'];

export interface CustomersScreenProps {
  /** null when the store is not connected or the connector cannot search customers. */
  source: CustomerSource | null;
  onBack(): void;
}

function searchErrorMessage(cause: unknown): string {
  return cause instanceof ConnectorUnauthorizedError ? 'Sign in again to search customers'
    : cause instanceof CustomerServiceError && cause.code === 'invalid' ? `The store refused: ${cause.message}`
    : `Could not reach the store's customers: ${(cause as Error).message}`;
}

export function CustomersScreen({ source, onBack }: CustomersScreenProps): JSX.Element {
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const request = useRef(0);
  const { width } = useWindowDimensions();

  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    const mine = ++request.current;
    setResults([]);
    setError(undefined);
    if (!source || query.length < MIN_QUERY_CHARS) {
      setSearching(false);
      return;
    }
    setSearching(true);
    source.search(query).then(found => {
      if (mine === request.current) setResults(found);
    }, cause => {
      if (mine === request.current) setError(searchErrorMessage(cause));
    }).finally(() => {
      if (mine === request.current) setSearching(false);
    });
  }, [source, query, attempt]);

  function clear() { setTerm(''); setQuery(''); }
  function retry() { setAttempt(n => n + 1); }

  const body = error ? (
    <View className="gap-2 p-4">
      <Text testID="customers-error" accessibilityRole="alert" className="text-destructive">{error}</Text>
      <Button testID="customers-retry" variant="outline" onPress={retry}><Text>Try again</Text></Button>
    </View>
  ) : searching ? (
    <Text testID="customers-searching" className="p-4 text-muted-foreground">Searching…</Text>
  ) : query.length < MIN_QUERY_CHARS ? (
    <View testID="no-data-message" className="flex-1 items-center justify-center gap-2 p-6">
      <Text testID="no-data-message-title" className="text-center font-medium text-foreground">Search Customers</Text>
      <Text testID="no-data-message-description" className="text-center text-muted-foreground">Type at least 2 characters of a name, email or phone.</Text>
    </View>
  ) : results.length === 0 ? (
    <View testID="no-data-message" className="flex-1 items-center justify-center gap-2 p-6">
      <Text testID="no-data-message-title" className="text-center font-medium text-foreground">No customers match your search</Text>
      <Button testID="no-data-message-action" variant="ghost" size="sm" onPress={clear}><Text>Clear search</Text></Button>
    </View>
  ) : (
    <ScrollView testID="customers-body">
      {width < 600 ? results.map(c => (
        <View key={c.id} testID={`customers-row-${c.id}`} className="gap-1 border-b border-border px-4 py-3">
          <Text className="font-medium text-foreground">{c.name}</Text>
          {c.email ? <Text testID={`customer-email-${c.email}`} numberOfLines={1} className="text-muted-foreground">{c.email}</Text> : null}
        </View>
      )) : <Table>
        <TableHeader><TableRow>
          {COLUMNS.map(h => <TableHead key={h}><Text>{h}</Text></TableHead>)}
        </TableRow></TableHeader>
        <TableBody>
          {results.map(c => <TableRow key={c.id} testID={`customers-row-${c.id}`}>
            <TableCell><Text>{c.name}</Text></TableCell>
            <TableCell><Text testID={c.email ? `customer-email-${c.email}` : undefined}>{c.email ?? ''}</Text></TableCell>
            <TableCell><Text>{c.phone ?? ''}</Text></TableCell>
            <TableCell><Text>{c.company ?? ''}</Text></TableCell>
          </TableRow>)}
        </TableBody>
      </Table>}
    </ScrollView>
  );

  return (
    <View testID="screen-customers" className="flex-1 bg-background">
      <View className="flex-row items-center justify-between p-4">
        <Text accessibilityRole="header">Customers</Text>
        <Button testID="customers-back" onPress={onBack}><Text>Back</Text></Button>
      </View>
      {source ? <>
        <View className="px-4 pb-2"><SearchInput testID="search-customers" value={term} onChangeText={setTerm} placeholder="Search Customers" /></View>
        {body}
      </> : <Text testID="customers-unavailable" className="p-4 text-muted-foreground">Customers show once the store is connected.</Text>}
    </View>
  );
}
