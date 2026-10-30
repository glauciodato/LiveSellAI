import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, gradientLive } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Passo 2 do checklist (Clonar uma voz) -- hoje é só informativo: a
 * clonagem já acontece automaticamente a partir do vídeo enviado no passo
 * 1 (ver avatar-service-aws/handler.py). Um upload de áudio dedicado, pra
 * melhor qualidade, é um passo futuro (ver ROADMAP.md).
 */
export default function VoiceCloneInfoScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <LinearGradient colors={gradientLive} style={styles.badge}>
          <Text style={styles.badgeText}>🎙️</Text>
        </LinearGradient>

        <Text style={styles.title}>Clonar uma voz</Text>
        <Text style={styles.body}>
          Boa notícia: isso já acontece sozinho. Quando você envia o vídeo no passo{' '}
          <Text style={styles.bold}>"Clonar um avatar"</Text>, a gente usa um trecho dele pra
          clonar sua voz automaticamente — não precisa gravar nem enviar nada separado.
        </Text>
        <Text style={styles.body}>
          Mais pra frente, vamos deixar você enviar um áudio dedicado aqui (geralmente dá um
          resultado ainda melhor). Por enquanto, siga pro passo 1.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.soft,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 28,
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 3,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 22,
  },
  title: {
    fontSize: 22,
    fontFamily: fonts.displayBold,
    color: colors.navy,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    color: colors.muted,
    lineHeight: 22,
    marginBottom: 12,
  },
  bold: {
    fontFamily: fonts.bodySemiBold,
    color: colors.navy,
  },
});
