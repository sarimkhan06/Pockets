import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { TEMPLATES } from '../data/onboardingData';

export default function SwitchMethodScreen({ navigation, route }) {
  const currentMethodId = route.params?.currentMethodId;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Budgeting Method</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Switching methods will update your starter pockets. Any pockets you've added won't be affected.
        </Text>

        {Object.values(TEMPLATES).map(method => {
          const isActive = method.id === currentMethodId;
          return (
            <TouchableOpacity
              key={method.id}
              style={[styles.card, isActive && styles.cardActive]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <View style={styles.cardLeft}>
                <Text style={styles.cardIcon}>{method.icon}</Text>
                <View style={styles.cardText}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardName}>{method.name}</Text>
                    {isActive && (
                      <View style={[styles.activeBadge, { backgroundColor: method.color + '22' }]}>
                        <Text style={[styles.activeBadgeText, { color: method.color }]}>Current</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardTagline}>{method.tagline}</Text>
                </View>
              </View>
              <View style={[styles.colorBar, { backgroundColor: method.color }]} />
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#151F32', alignItems: 'center', justifyContent: 'center',
  },
  backText: { fontSize: 20, color: '#FFFFFF' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  headerSpacer: { width: 38 },

  subtitle: {
    fontSize: 13, color: '#8899AA', paddingHorizontal: 20,
    marginBottom: 20, lineHeight: 20,
  },

  card: {
    marginHorizontal: 20, backgroundColor: '#151F32', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 10, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center',
  },
  cardActive: { borderColor: '#00D4AA' },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16 },
  cardIcon: { fontSize: 28, marginRight: 14 },
  cardText: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  activeBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  activeBadgeText: { fontSize: 11, fontWeight: '700' },
  cardTagline: { fontSize: 12, color: '#8899AA' },
  colorBar: { width: 4, alignSelf: 'stretch' },
});
