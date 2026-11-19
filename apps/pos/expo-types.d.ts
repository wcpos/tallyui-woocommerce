/// <reference types="expo/types" />
// Lets tsc run on a clean checkout, where the generated expo-env.d.ts is absent.
// A bundled font file: on web, Metro and Vite export its URL (lib/theme/font-faces.ts).
declare module '*.ttf' { const uri: string; export default uri; }
