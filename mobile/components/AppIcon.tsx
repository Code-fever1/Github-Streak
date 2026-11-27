import { StyleSheet, View, type ColorValue } from 'react-native';

export type AppIconName =
  | 'dashboard'
  | 'github'
  | 'charge'
  | 'notification'
  | 'settings'
  | 'memory'
  | 'chevron'
  | 'plus'
  | 'check'
  | 'alert';

interface Props {
  name: AppIconName;
  color: ColorValue;
  size?: number;
  active?: boolean;
}

const STROKE = 1.75;

/** Minimalist geometric vector-style icons built with RN View primitives (zero emoji glyphs). */
export function AppIcon({ name, color, size = 20, active = false }: Props) {
  const s = size;

  if (name === 'dashboard') {
    const cell = Math.max(5, Math.round((s - 6) / 2));
    return (
      <View
        style={[styles.box, { width: s, height: s }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <View style={styles.dashGrid}>
          <View
            style={[
              styles.dashCell,
              { width: cell, height: cell, borderColor: color },
              active && { backgroundColor: color },
            ]}
          />
          <View style={[styles.dashCell, { width: cell, height: cell, borderColor: color }]} />
          <View style={[styles.dashCell, { width: cell, height: cell, borderColor: color }]} />
          <View style={[styles.dashCell, { width: cell, height: cell, borderColor: color }]} />
        </View>
      </View>
    );
  }

  if (name === 'github') {
    const dot = Math.max(4, Math.round(s * 0.24));
    const stemX = Math.round(s * 0.26);
    const branchX = Math.round(s * 0.68);
    return (
      <View
        style={[styles.box, { width: s, height: s }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <View
          style={{
            position: 'absolute',
            left: stemX + dot / 2 - STROKE / 2,
            top: dot - 1,
            bottom: dot - 1,
            width: STROKE,
            backgroundColor: color,
            borderRadius: 1,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: stemX + dot / 2 - STROKE / 2,
            top: Math.round(s * 0.48),
            width: branchX - stemX,
            height: STROKE,
            backgroundColor: color,
            borderRadius: 1,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: stemX,
            top: 2,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            borderWidth: STROKE,
            borderColor: color,
            backgroundColor: active ? color : 'transparent',
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: stemX,
            bottom: 2,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            borderWidth: STROKE,
            borderColor: color,
            backgroundColor: active ? color : 'transparent',
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: branchX - dot / 2,
            top: Math.round(s * 0.48) - dot / 2 + STROKE / 2,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            borderWidth: STROKE,
            borderColor: color,
            backgroundColor: color,
          }}
        />
      </View>
    );
  }

  if (name === 'charge') {
    const bodyW = Math.round(s * 0.8);
    const bodyH = Math.round(s * 0.54);
    const nubW = Math.max(2, Math.round(s * 0.1));
    const nubH = Math.max(4, Math.round(bodyH * 0.45));
    return (
      <View
        style={[styles.box, { width: s, height: s, flexDirection: 'row', alignItems: 'center' }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <View
          style={{
            width: bodyW,
            height: bodyH,
            borderRadius: 3,
            borderWidth: STROKE,
            borderColor: color,
            padding: 2,
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: active ? '78%' : '56%',
              height: '100%',
              borderRadius: 1.5,
              backgroundColor: color,
            }}
          />
        </View>
        <View
          style={{
            width: nubW,
            height: nubH,
            marginLeft: 1.5,
            borderTopRightRadius: 1.5,
            borderBottomRightRadius: 1.5,
            backgroundColor: color,
          }}
        />
      </View>
    );
  }

  if (name === 'notification') {
    const domeW = Math.round(s * 0.56);
    const domeH = Math.round(s * 0.56);
    const rimW = Math.round(s * 0.78);
    const clapper = Math.max(3, Math.round(s * 0.18));
    return (
      <View
        style={[styles.box, { width: s, height: s, alignItems: 'center', justifyContent: 'center' }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <View
          style={{
            width: domeW,
            height: domeH,
            borderTopLeftRadius: domeW / 2,
            borderTopRightRadius: domeW / 2,
            borderWidth: STROKE,
            borderBottomWidth: 0,
            borderColor: color,
            backgroundColor: active ? color : 'transparent',
          }}
        />
        <View
          style={{
            width: rimW,
            height: STROKE,
            borderRadius: 1,
            backgroundColor: color,
          }}
        />
        <View
          style={{
            width: clapper,
            height: clapper,
            marginTop: 2,
            borderRadius: clapper / 2,
            backgroundColor: color,
          }}
        />
      </View>
    );
  }

  if (name === 'settings') {
    const trackW = Math.round(s * 0.8);
    const knob = Math.max(4, Math.round(s * 0.24));
    return (
      <View
        style={[
          styles.box,
          { width: s, height: s, alignItems: 'center', justifyContent: 'center', gap: Math.max(4, Math.round(s * 0.22)) },
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <View style={{ width: trackW, height: STROKE, backgroundColor: color, borderRadius: 1, justifyContent: 'center' }}>
          <View
            style={{
              width: knob,
              height: knob,
              borderRadius: knob / 2,
              borderWidth: STROKE,
              borderColor: color,
              backgroundColor: active ? color : '#090B0E',
              marginLeft: Math.round(trackW * 0.16),
            }}
          />
        </View>
        <View style={{ width: trackW, height: STROKE, backgroundColor: color, borderRadius: 1, justifyContent: 'center' }}>
          <View
            style={{
              width: knob,
              height: knob,
              borderRadius: knob / 2,
              borderWidth: STROKE,
              borderColor: color,
              backgroundColor: active ? color : '#090B0E',
              marginLeft: Math.round(trackW * 0.54),
            }}
          />
        </View>
      </View>
    );
  }

  if (name === 'memory') {
    const outer = Math.round(s * 0.72);
    const core = Math.max(4, Math.round(s * 0.28));
    return (
      <View
        style={[styles.box, { width: s, height: s }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <View
          style={{
            width: outer,
            height: outer,
            borderRadius: 3,
            borderWidth: STROKE,
            borderColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: core,
              height: core,
              borderRadius: 1,
              backgroundColor: color,
            }}
          />
        </View>
      </View>
    );
  }

  if (name === 'chevron') {
    const leg = Math.max(5, Math.round(s * 0.42));
    return (
      <View
        style={[styles.box, { width: s, height: s }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <View
          style={{
            width: leg,
            height: leg,
            borderTopWidth: STROKE,
            borderRightWidth: STROKE,
            borderColor: color,
            transform: [{ rotate: '45deg' }, { translateX: -1 }],
          }}
        />
      </View>
    );
  }

  if (name === 'plus') {
    const arm = Math.round(s * 0.68);
    return (
      <View
        style={[styles.box, { width: s, height: s }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <View style={{ position: 'absolute', width: arm, height: STROKE, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ position: 'absolute', width: STROKE, height: arm, backgroundColor: color, borderRadius: 1 }} />
      </View>
    );
  }

  if (name === 'check') {
    const w = Math.round(s * 0.56);
    const h = Math.round(s * 0.32);
    return (
      <View
        style={[styles.box, { width: s, height: s }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <View
          style={{
            width: w,
            height: h,
            borderLeftWidth: STROKE,
            borderBottomWidth: STROKE,
            borderColor: color,
            transform: [{ rotate: '-45deg' }, { translateY: -1 }],
          }}
        />
      </View>
    );
  }

  // alert
  const stemH = Math.round(s * 0.42);
  const dotSize = Math.max(2.5, STROKE + 0.5);
  return (
    <View
      style={[styles.box, { width: s, height: s, gap: 2.5 }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <View style={{ width: STROKE, height: stemH, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  dashGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dashCell: {
    borderWidth: STROKE,
    borderRadius: 2,
  },
});
