import { Pressable, StyleSheet, Text } from 'react-native';

export type ActionVariant = 'default' | 'outline' | 'danger' | 'ghost';

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ActionVariant;
  compact?: boolean;
  selected?: boolean;
  accessibilityLabel?: string;
}

/** 手机端统一按钮：默认深色主操作、outline 次操作、danger 删除。 */
export function ActionButton({
  label,
  onPress,
  disabled = false,
  variant = 'default',
  compact = false,
  selected = false,
  accessibilityLabel,
}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        compact && styles.compact,
        variant === 'default' && styles.default,
        variant === 'outline' && styles.outline,
        variant === 'danger' && styles.danger,
        variant === 'ghost' && styles.ghost,
        selected && styles.selected,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.text,
          compact && styles.compactText,
          (variant === 'default' || variant === 'danger') && styles.lightText,
          selected && styles.selectedText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  compact: { minHeight: 30, paddingHorizontal: 8, paddingVertical: 5 },
  default: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  outline: { backgroundColor: '#ffffff', borderColor: '#cbd5e1' },
  danger: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  selected: { backgroundColor: '#bfdbfe', borderColor: '#2563eb' },
  disabled: { opacity: 0.45 },
  text: { color: '#0f172a', fontSize: 14, fontWeight: '600' },
  compactText: { fontSize: 12 },
  lightText: { color: '#f8fafc' },
  selectedText: { color: '#1e3a8a' },
});
