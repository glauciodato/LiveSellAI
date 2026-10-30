import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { colors, fonts, radius } from '../theme';

/** Campo de texto padrão das telas de autenticação — borda destaca em azul ao focar. */
export default function AuthTextInput(props: TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      placeholderTextColor={colors.muted}
      style={[styles.input, focused && styles.inputFocused, props.style]}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    fontFamily: fonts.bodyRegular,
    color: colors.navy,
    backgroundColor: colors.white,
    marginTop: 12,
  },
  inputFocused: {
    borderColor: colors.electric,
  },
});
