// Mirrors WCPOS v2's products/cart resize handle.
import { useRef, type JSX, type KeyboardEvent } from 'react';
import { PanResponder, View, type ViewProps } from 'react-native';
import {
  dragProductsWidth, moveProductsWidth, PRODUCTS_WIDTH_DEFAULT, PRODUCTS_WIDTH_MIN,
  PRODUCTS_WIDTH_MAX, PRODUCTS_WIDTH_STEP, type PanelPosition,
} from '../lib/catalogue/catalogue-view-state';

// Two releases within these movement/time limits reset to the default width.
const TAP_DISTANCE = 3;
const DOUBLE_TAP_MS = 300;

export interface PanelResizeHandleProps {
  width: number;
  position: PanelPosition;
  groupWidth: number;
  onResize: (width: number) => void;
  onCommit: (width: number) => void;
}

interface WebViewProps extends ViewProps {
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  'aria-orientation': 'vertical';
}

export function PanelResizeHandle(props: PanelResizeHandleProps): JSX.Element {
  const latest = useRef(props);
  latest.current = props;
  const start = useRef(props.width);
  const lastTap = useRef<number | null>(null);
  const responder = useRef<ReturnType<typeof PanResponder.create> | null>(null);
  if (responder.current === null) {
    responder.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { start.current = latest.current.width; },
      onPanResponderMove: (_, gesture) => {
        const { groupWidth, position, onResize } = latest.current;
        onResize(dragProductsWidth(start.current, gesture.dx, groupWidth, position));
      },
      onPanResponderRelease: (_, gesture) => {
        const { groupWidth, position, onCommit } = latest.current;
        const now = Date.now();
        const isTap = Math.abs(gesture.dx) < TAP_DISTANCE;
        if (isTap && lastTap.current !== null && now - lastTap.current < DOUBLE_TAP_MS) {
          lastTap.current = null;
          onCommit(PRODUCTS_WIDTH_DEFAULT);
        } else {
          lastTap.current = isTap ? now : null;
          onCommit(dragProductsWidth(start.current, gesture.dx, groupWidth, position));
        }
      },
      onPanResponderTerminate: () => { latest.current.onResize(start.current); },
    });
  }
  const webProps: WebViewProps = {
    'aria-orientation': 'vertical',
    onKeyDown: event => {
      let delta: number;
      switch (event.key) {
        case 'ArrowRight': delta = PRODUCTS_WIDTH_STEP; break;
        case 'ArrowLeft': delta = -PRODUCTS_WIDTH_STEP; break;
        case 'End': delta = 100; break;
        case 'Home': delta = -100; break;
        default: return;
      }
      props.onCommit(moveProductsWidth(props.width, delta, props.position));
      event.preventDefault();
    },
  };
  return (
    <View {...responder.current.panHandlers} {...webProps as ViewProps}
      testID="pos-resize-handle" role="separator" aria-label="Resize products and cart"
      aria-valuemin={PRODUCTS_WIDTH_MIN} aria-valuemax={PRODUCTS_WIDTH_MAX}
      aria-valuenow={Math.round(props.width)} focusable tabIndex={0}
      className="w-2 items-center justify-center cursor-ew-resize">
      <View className="h-8 w-1 rounded-full bg-border" />
    </View>
  );
}
