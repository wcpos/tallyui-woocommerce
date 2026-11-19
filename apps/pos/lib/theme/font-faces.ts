import { FONT_FACES } from '@tallyui/theme';
import type { ThemeFontFamily } from '@tallyui/theme';
// v2's static faces (packages/components/assets/fonts, SIL OFL 1.1; see LICENSE.md there and here).
import DMSans400 from '../../assets/fonts/DMSans-400.ttf';
import DMSans500 from '../../assets/fonts/DMSans-500.ttf';
import DMSans600 from '../../assets/fonts/DMSans-600.ttf';
import DMSans700 from '../../assets/fonts/DMSans-700.ttf';
import Fraunces500 from '../../assets/fonts/Fraunces-500.ttf';
import Fraunces500Italic from '../../assets/fonts/Fraunces-500Italic.ttf';
import Fraunces600 from '../../assets/fonts/Fraunces-600.ttf';
import Fraunces600Italic from '../../assets/fonts/Fraunces-600Italic.ttf';
import InstrumentSerif400 from '../../assets/fonts/InstrumentSerif-400.ttf';
import InstrumentSerif400Italic from '../../assets/fonts/InstrumentSerif-400Italic.ttf';
import JetBrainsMono400 from '../../assets/fonts/JetBrainsMono-400.ttf';
import JetBrainsMono500 from '../../assets/fonts/JetBrainsMono-500.ttf';
import JetBrainsMono600 from '../../assets/fonts/JetBrainsMono-600.ttf';
import Manrope500 from '../../assets/fonts/Manrope-500.ttf';
import Manrope600 from '../../assets/fonts/Manrope-600.ttf';
import Manrope700 from '../../assets/fonts/Manrope-700.ttf';
import Manrope800 from '../../assets/fonts/Manrope-800.ttf';
import SpaceGrotesk500 from '../../assets/fonts/SpaceGrotesk-500.ttf';
import SpaceGrotesk600 from '../../assets/fonts/SpaceGrotesk-600.ttf';
import SpaceGrotesk700 from '../../assets/fonts/SpaceGrotesk-700.ttf';

// Each file's URL, keyed by its FONT_FACES name without the dash and extension.
const FILES: Record<string, string> = {
  DMSans400, DMSans500, DMSans600, DMSans700, Fraunces500, Fraunces500Italic, Fraunces600, Fraunces600Italic,
  InstrumentSerif400, InstrumentSerif400Italic, JetBrainsMono400, JetBrainsMono500, JetBrainsMono600,
  Manrope500, Manrope600, Manrope700, Manrope800, SpaceGrotesk500, SpaceGrotesk600, SpaceGrotesk700,
};

const registered = new Map<ThemeFontFamily, Promise<void>>();

// expo-font 14 registers one file per family name with no weight or style, so the browser's FontFace API
// registers each weight under the one family name that TallyUI's fontFamilyStyle asks for.
async function registerFamily(family: ThemeFontFamily): Promise<void> {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) {
    throw new Error('Font registration needs the web FontFace API');
  }
  await Promise.all(FONT_FACES[family].map(async ({ file, weight, style }) => {
    const face = new FontFace(family, `url(${FILES[file.replace(/-|\.ttf$/g, '')]})`, { weight: String(weight), style: style ?? 'normal', display: 'swap' });
    // FontFaceSet's set methods are in lib.dom.iterable, which the app's tsconfig does not load.
    (document.fonts as unknown as Set<FontFace>).add(await face.load());
  }));
}

/** Registers these families' bundled faces once; a family that failed is tried again next time. */
export function loadFontFamilies(families: ThemeFontFamily[]): Promise<void> {
  return Promise.all(families.map(family => {
    let pending = registered.get(family);
    if (!pending) {
      pending = registerFamily(family);
      registered.set(family, pending);
      pending.catch(() => registered.delete(family));
    }
    return pending;
  })).then(() => undefined);
}
