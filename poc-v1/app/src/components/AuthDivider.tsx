import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

/** Separador "ou" entre o formulário e o login social. */
export default function AuthDivider() {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text style={styles.text}>ou</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  text: {
    marginHorizontal: 12,
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.muted,
  },
});
