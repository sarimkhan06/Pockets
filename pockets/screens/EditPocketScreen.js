import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';

import { API_URL } from '../lib/config';

const COLORS = ['#00D4AA', '#FF5252', '#448AFF', '#FF9F43', '#B39DDB', '#FF6B9D', '#00BCD4', '#8BC34A'];

export default function EditPocketScreen({ route, navigation }) {
  const { pocket } = route.params;
  const [name, setName] = useState(pocket.name);
  const [balance, setBalance] = useState(String(pocket.balance));
  const [selectedColor, setSelectedColor] = useState(pocket.color);
  const [loading, setLoading] = useState(false);
  const [includeInDist, setIncludeInDist] = useState(pocket.income_percent != null);
  const [incomePercent, setIncomePercent] = useState(pocket.income_percent != null ? String(pocket.income_percent) : '');


  const handleSave = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/pockets/${pocket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          balance: parseFloat(balance),
          color: selectedColor,
          income_percent: includeInDist ? (parseFloat(incomePercent) || null) : null,
        }),
      });
      navigation.navigate('Dashboard');
    } catch (error) {
      console.error('Failed to update pocket:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Pocket',
      `Are you sure you want to delete "${pocket.name}"? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await fetch(`${API_URL}/pockets/${pocket.id}`, { method: 'DELETE' });
            navigation.navigate('Dashboard');
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Pocket</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Preview */}
        <View style={styles.previewCard}>
          <View style={[styles.previewTopBar, { backgroundColor: selectedColor }]} />
          <Text style={styles.previewName}>{name || 'Pocket name'}</Text>
          <Text style={[styles.previewAmount, { color: selectedColor }]}>
            ${balance || '0'}
          </Text>
          <Text style={styles.previewLabel}>budget</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pocket Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Groceries, Rent..."
              placeholderTextColor="#4A5E78"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Balance</Text>
            <View style={styles.amountRow}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={[styles.input, styles.amountInput]}
                value={balance}
                onChangeText={setBalance}
                placeholder="0.00"
                placeholderTextColor="#4A5E78"
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Color</Text>
            <View style={styles.colorRow}>
              {COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorDot, { backgroundColor: color }, selectedColor === color && styles.colorDotSelected]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Income Distribution</Text>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Include in income split</Text>
              <Switch
                value={includeInDist}
                onValueChange={setIncludeInDist}
                trackColor={{ false: '#1C2B45', true: 'rgba(0,212,170,0.4)' }}
                thumbColor={includeInDist ? '#00D4AA' : '#4A5E78'}
              />
            </View>
            {includeInDist && (
              <View style={[styles.amountRow, { marginTop: 10 }]}>
                <TextInput
                  style={[styles.input, styles.amountInput]}
                  placeholder="0"
                  placeholderTextColor="#4A5E78"
                  keyboardType="numeric"
                  value={incomePercent}
                  onChangeText={setIncomePercent}
                />
                <Text style={styles.percentSign}>% of income</Text>
              </View>
            )}
          </View>

        </View>

        <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.7 }]} onPress={handleSave} disabled={loading} activeOpacity={0.85}>
          {loading
            ? <ActivityIndicator color="#0B1120" />
            : <Text style={styles.saveBtnText}>Save Changes</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.85}>
          <Text style={styles.deleteBtnText}>Delete Pocket</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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

  previewCard: {
    marginHorizontal: 20, backgroundColor: '#151F32', borderRadius: 20,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 24, paddingBottom: 20,
  },
  previewTopBar: { height: 5, width: '100%', marginBottom: 16 },
  previewName: { fontSize: 16, color: '#8899AA', paddingHorizontal: 20, marginBottom: 4 },
  previewAmount: { fontSize: 36, fontWeight: '800', paddingHorizontal: 20, letterSpacing: -0.5 },
  previewLabel: { fontSize: 12, color: '#4A5E78', paddingHorizontal: 20 },

  form: { paddingHorizontal: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#8899AA', marginBottom: 8 },
  input: {
    backgroundColor: '#151F32', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#FFFFFF',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', flex: 1,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  dollarSign: { fontSize: 20, color: '#8899AA', marginRight: 8 },
  amountInput: { flex: 1 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  colorDotSelected: { borderWidth: 3, borderColor: '#FFFFFF' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 14, color: '#FFFFFF' },
  percentSign: { fontSize: 14, color: '#8899AA', marginLeft: 8 },

  saveBtn: {
    marginHorizontal: 20, backgroundColor: '#00D4AA',
    borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 12,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#0B1120' },
  deleteBtn: {
    marginHorizontal: 20, backgroundColor: 'transparent',
    borderRadius: 16, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#FF5252',
  },
  deleteBtnText: { fontSize: 15, fontWeight: '700', color: '#FF5252' },
});
