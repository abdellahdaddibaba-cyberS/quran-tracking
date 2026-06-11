import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../context/ThemeContext';
import { spacing, radius } from '../../constants/layout';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  style?: ViewStyle;
};

export function ScreenHeader({ title, subtitle, onBack, right, style }: ScreenHeaderProps) {
  const router = useRouter();
  const { colors } = useAppTheme();

  return (
    <View style={[styles.wrap, { borderBottomColor: colors.border, backgroundColor: colors.background }, style]}>
      <TouchableOpacity
        onPress={onBack ?? (() => router.back())}
        style={[styles.backBtn, { backgroundColor: colors.surfaceTrans }]}
        hitSlop={12}
      >
        <ChevronRight size={22} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.titles}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : <View style={styles.rightPlaceholder} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + 8,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titles: {
    flex: 1,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    textAlign: 'right',
  },
  right: {
    minWidth: 42,
    alignItems: 'flex-start',
  },
  rightPlaceholder: {
    width: 42,
  },
});
