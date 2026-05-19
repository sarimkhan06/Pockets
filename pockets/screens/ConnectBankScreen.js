import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default function ConnectBankScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connect Bank</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroEmoji}>🏦</Text>
          </View>
          <Text style={styles.heroTitle}>Connect your bank account</Text>
          <Text style={styles.heroSubtitle}>
            Pockets uses Plaid to securely connect to your bank. Your login credentials are
            never stored by us.
          </Text>
        </View>

        <View style={styles.featuresCard}>
          {[
            { icon: '⚡', title: 'Live transactions', desc: 'New transactions appear in your inbox automatically.' },
            { icon: '🔒', title: 'Bank-level security', desc: 'Plaid is trusted by thousands of apps and millions of users.' },
            { icon: '👁', title: 'Read-only access', desc: 'We can only read your transactions — we cannot move money.' },
          ].map((f, i) => (
            <View key={i} style={[styles.featureRow, i < 2 && styles.featureBorder]}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>
            🚧  Bank connection is coming soon. This feature will be available once the backend is set up.
          </Text>
        </View>

        <TouchableOpacity style={styles.connectBtn} activeOpacity={0.85}>
          <Text style={styles.connectBtnText}>Connect with Plaid</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#151F32', alignItems: 'center', justifyContent: 'center',
  },
  backText: { fontSize: 20, color: '#FFFFFF' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  headerSpacer: { width: 38 },

  hero: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 24, paddingBottom: 32 },
  heroIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#151F32', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  heroEmoji: { fontSize: 36 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginBottom: 12 },
  heroSubtitle: { fontSize: 14, color: '#8899AA', textAlign: 'center', lineHeight: 22 },

  featuresCard: {
    marginHorizontal: 20, backgroundColor: '#151F32', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 16, overflow: 'hidden',
  },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 16 },
  featureBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  featureIcon: { fontSize: 22, marginRight: 14, marginTop: 2 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 3 },
  featureDesc: { fontSize: 13, color: '#8899AA', lineHeight: 18 },

  noticeCard: {
    marginHorizontal: 20, backgroundColor: '#1C2B45', borderRadius: 12,
    padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  noticeText: { fontSize: 13, color: '#8899AA', lineHeight: 20 },

  connectBtn: {
    marginHorizontal: 20, backgroundColor: '#1C2B45',
    borderRadius: 16, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  connectBtnText: { fontSize: 15, fontWeight: '700', color: '#4A5E78' },
});
