import { ScrollView, StyleSheet, Text, View } from 'react-native';
import ChecklistItem from '../components/ChecklistItem';
import AppHeader from '../components/AppHeader';
import { colors, fonts } from '../theme';
import type { Tenant } from '../types/tenant';

export type OnboardingStep = 'avatar' | 'voice';

interface HomeScreenProps {
  tenant: Tenant;
  onNavigateToStep: (step: OnboardingStep) => void;
  onChangePassword: () => void;
  onLogout: () => void;
}

const STEPS: Array<{
  key: OnboardingStep | null;
  label: string;
  description?: string;
}> = [
  { key: 'avatar', label: 'Clonar um avatar', description: 'Envie um vídeo de treino' },
  { key: 'voice', label: 'Clonar uma voz', description: 'Automático, a partir do vídeo' },
  { key: null, label: 'Criar o script' },
  { key: null, label: 'Conectar um LLM', description: 'Gerar falas com IA' },
  { key: null, label: 'Testar a transmissão' },
  { key: null, label: 'Entrar ao vivo' },
  { key: null, label: 'Compartilhar o link da live' },
];

/**
 * Tela principal depois do login -- checklist guiado dos passos pra colocar
 * o avatar no ar. Só os 2 primeiros passos têm tela de verdade por enquanto
 * (ver história "Home com checklist de onboarding" no BACKLOG.md); os
 * demais aparecem como "Em breve".
 */
export default function HomeScreen({
  tenant,
  onNavigateToStep,
  onChangePassword,
  onLogout,
}: HomeScreenProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AppHeader
        tenant={tenant}
        onNavigateHome={() => {}}
        onChangePassword={onChangePassword}
        onLogout={onLogout}
      />

      <Text style={styles.greeting}>Olá, {tenant.name.split(' ')[0]} 👋</Text>
      <Text style={styles.subtitle}>{tenant.email}</Text>

      <Text style={styles.sectionTitle}>Comece por aqui</Text>
      <Text style={styles.sectionSubtitle}>
        Siga os passos abaixo pra colocar seu avatar de vendas no ar.
      </Text>

      <View style={styles.card}>
        {STEPS.map((step, index) => (
          <ChecklistItem
            key={step.label}
            step={index + 1}
            label={step.label}
            description={step.description}
            disabled={!step.key}
            isLast={index === STEPS.length - 1}
            onPress={step.key ? () => onNavigateToStep(step.key as OnboardingStep) : undefined}
          />
        ))}
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
  greeting: {
    fontSize: 24,
    fontFamily: fonts.displayBold,
    color: colors.navy,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.muted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: fonts.bodySemiBold,
    color: colors.navy,
    marginTop: 32,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 3,
    overflow: 'hidden',
  },
});
