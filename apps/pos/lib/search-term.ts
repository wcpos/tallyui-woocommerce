import { useEffect, useState } from 'react';

// The area screens' search box: what is typed shows at once, and the search runs 250 ms after the last keystroke.
const SEARCH_DEBOUNCE_MS = 250;

export interface SearchTerm {
  /** What the search box shows. */
  term: string;
  /** The trimmed term once typing has paused; what the screen searches for. */
  query: string;
  /** Typing: the box updates now, the query after the pause. */
  type(term: string): void;
  /** Clear or scan: the box and the query update together, with no wait. */
  set(term: string): void;
}

export function useSearchTerm(): SearchTerm {
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  const type = setTerm;
  const set = (value: string) => { setTerm(value); setQuery(value.trim()); };
  return { term, query, type, set };
}
