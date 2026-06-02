import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../../context/ThemeContext';
import { spacing, radius } from '../../constants/layout';

type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
};

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconRing, { backgroundColor: colors.surfaceTrans, borderColor: colors.border }]}>
        {icon}
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
});
