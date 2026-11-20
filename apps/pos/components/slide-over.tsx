import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, View, type ViewStyle } from 'react-native';

// v2 components lib/motion.ts:22 PANE: arriving, the same beat as a pane push.
export const PANE = 280;
// v2 components lib/motion.ts:20 PANEL_SLIDE_OUT: leaving, quicker than arriving.
export const PANEL_SLIDE_OUT = 200;
// v2 components lib/motion.ts:29 EASE_POINTS: the shared ease.
const EASE_POINTS = [0.2, 0.7, 0.2, 1] as const;
// v2 components lib/motion.ts:33 EASE_EXIT_POINTS: speed up into the edge, or the surface creeps as a sliver there.
const EASE_EXIT_POINTS = [0.4, 0, 1, 1] as const;

const ARRIVE = `cubic-bezier(${EASE_POINTS.join(', ')})`;
const LEAVE = `cubic-bezier(${EASE_EXIT_POINTS.join(', ')})`;

export type SlideOverProps = {
  open: boolean;
  /** The edge the cover comes out of, and goes back into. */
  from: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
  /** Places the frame the cover travels in; the frame clips it at the edge it comes from. */
  className?: string;
  style?: ViewStyle;
  /** The cover hides what is under it, so it needs the surface's own opaque background. */
  coverClassName?: string;
  /** Called once the cover has slid out and unmounted. */
  onLeft?: () => void;
  testID?: string;
};

// v2 useReducedMotion: on web the media query, read once per mount; on native the system setting.
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => Platform.OS === 'web' && typeof window !== 'undefined'
    && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(on => { if (live) setReduced(on); }, () => undefined);
    return () => { live = false; };
  }, []);
  return reduced;
}

/**
 * A cover that slides out of one edge of its frame and back into it (v2 components slide-over/index.tsx). The frame
 * clips, so the cover appears to come out of whatever sits against that edge. The cover stays mounted until it has
 * left, only `transform` animates, and what it covers does not move.
 * v2's slide is a Reanimated CSS transition; the app has no Reanimated, so this is RN-web's own CSS transition style
 * props, which the browser runs off the main thread just the same. Native gets no transition: RN ignores those props,
 * so there the cover appears and disappears.
 */
export function SlideOver({ open, from, children, className, style, coverClassName, onLeft, testID }: SlideOverProps): JSX.Element | null {
  const reduced = useReducedMotion();
  const [staged, setStaged] = useState(open);
  // `landed` moves one frame after `staged`: the cover is painted parked outside its frame first, so the transition
  // has a position to start from. A cover that mounts already open is in place: nothing slides on mount.
  const [landed, setLanded] = useState(open);
  const left = useRef(onLeft);
  useEffect(() => { left.current = onLeft; });
  if (open && !staged) setStaged(true);
  if (!open && landed) setLanded(false);

  useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => setLanded(true));
      return () => cancelAnimationFrame(frame);
    }
    // A cover that never opened has nothing to leave.
    if (!staged) return;
    // A close interrupted by a reopen clears this, and the cover stays.
    const timer = setTimeout(() => { setStaged(false); left.current?.(); }, reduced ? 0 : PANEL_SLIDE_OUT);
    return () => clearTimeout(timer);
  }, [open, staged, reduced]);

  if (!staged) return null;
  // A percentage is of the cover's own size: nothing to measure before the first frame.
  const parked = from === 'bottom' || from === 'right' ? '100%' : '-100%';
  const offset = landed ? '0%' : parked;
  const transform = from === 'left' || from === 'right' ? [{ translateX: offset }] : [{ translateY: offset }];
  const motion = Platform.OS === 'web' ? { transitionProperty: 'transform',
    transitionDuration: `${reduced ? 0 : landed ? PANE : PANEL_SLIDE_OUT}ms`, transitionTimingFunction: landed ? ARRIVE : LEAVE } : {};
  return (
    <View testID={testID} className={`overflow-hidden ${className ?? ''}`} style={[style, { pointerEvents: 'box-none' }]}>
      {/* A cover that is leaving is already gone to a screen reader. */}
      <View testID={testID && `${testID}-panel`} className={`flex-1 ${coverClassName ?? ''}`} aria-hidden={!open}
        style={{ transform, ...motion, pointerEvents: open ? 'auto' : 'none' } as ViewStyle}>
        {children}
      </View>
    </View>
  );
}
