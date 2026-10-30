import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radius } from '../theme';

interface ChecklistItemProps {
  step: number;
  label: string;
  /** Linha de baixo, opcional (ex: explicação curta do passo). */
  description?: string;
  done?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  isLast?: boolean;
}

/** Uma linha do checklist de onboarding do Home -- numerada, com estado habilitado/concluído/em breve. */
export default function ChecklistItem({
  step,
  label,
  description,
  done = false,
  disabled = false,
  onPress,
  isLast = false,
}: ChecklistItemProps) {
  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowBorder]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.6}
    >
      <View style={[styles.badge, done && styles.badgeDone]}>
        <Text style={[styles.badgeText, done && styles.badgeTextDone]}>
          {done ? '✓' : step}
        </Text>
      </View>

      <View style={styles.textColumn}>
        <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, disabled && styles.labelDisabled]}>
            {description}
          </Text>
        ) : null}
      </View>

      {disabled ? (
        <View style={styles.comingSoonPill}>
          <Text style={styles.comingSoonText}>Em breve</Text>
        </View>
      ) : (
        <Text style={styles.arrow}>↗</Text>
      )}
    </TouchableOpacity>
  );
}

const BADGE_SIZE = 28;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.soft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeDone: {
    backgroundColor: colors.electric,
    borderColor: colors.electric,
  },
  badgeText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: colors.muted,
  },
  badgeTextDone: {
    color: colors.white,
  },
  textColumn: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontFamily: fonts.bodySemiBold,
    color: colors.navy,
  },
  labelDisabled: {
    color: colors.muted,
  },
  description: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.muted,
    marginTop: 2,
  },
  arrow: {
    fontSize: 16,
    color: colors.muted,
  },
  comingSoonPill: {
    backgroundColor: colors.soft,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  comingSoonText: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: colors.muted,
  },
});
