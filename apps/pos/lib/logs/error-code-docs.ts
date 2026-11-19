// WCPOS v2's error-code docs root (monorepo packages/utils/src/logger/constants.ts).
export const ERROR_CODE_DOCS_BASE_URL = 'https://docs.wcpos.com/error-codes';

// v2's getErrorCodeDocURL (packages/utils/src/logger/constants.ts:14): the code's own docs page.
export function errorCodeDocUrl(code: string): string {
  return `${ERROR_CODE_DOCS_BASE_URL}/${code}`;
}
