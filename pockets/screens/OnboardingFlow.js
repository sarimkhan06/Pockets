import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Dimensions, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  knowledgeableQuestions,
  unsureQuestions,
  determineMethod,
} from '../data/onboardingData';

const { width } = Dimensions.get('window');

// ─── Step 0: Personal profile ─────────────────────────────────────────────────

const AGE_RANGES = ['Under 18', '18 – 24', '25 – 34', '35 – 44', '45+'];
const LIFE_STAGES = [
  { id: 'student',  label: 'Student',         icon: '🎓' },
  { id: 'working',  label: 'Working',          icon: '💼' },
  { id: 'both',     label: 'Student + Working', icon: '⚡' },
  { id: 'other',    label: 'Other',            icon: '✌️' },
];
const GOALS = [
  'Save more consistently',
  'Pay off debt',
  'Build an emergency fund',
  'Stop overspending',
  'Start investing',
  'Just understand my money',
];

function ProfileStep({ onNext }) {
  const [name, setName] = useState('');
  const [age, setAge] = useState(null);
  const [stage, setStage] = useState(null);
  const [goal, setGoal] = useState(null);

  const canContinue = name.trim() && age && stage && goal;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.topSection}>
          <Text style={styles.stepLabel}>Welcome to Pockets</Text>
          <Text style={styles.title}>Tell us a little about yourself</Text>
          <Text style={styles.subtitle}>This helps us personalise your experience.</Text>
        </View>

        {/* Name */}
        <View style={styles.profileSection}>
          <Text style={styles.profileLabel}>What's your first name?</Text>
          <TextInput
            style={styles.profileInput}
            placeholder="Your name..."
            placeholderTextColor="#4A5E78"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        {/* Age */}
        <View style={styles.profileSection}>
          <Text style={styles.profileLabel}>How old are you?</Text>
          <View style={styles.chipRow}>
            {AGE_RANGES.map(range => (
              <TouchableOpacity
                key={range}
                style={[styles.chip, age === range && styles.chipSelected]}
                onPress={() => setAge(range)}
              >
                <Text style={[styles.chipText, age === range && styles.chipTextSelected]}>
                  {range}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Life stage */}
        <View style={styles.profileSection}>
          <Text style={styles.profileLabel}>What best describes you?</Text>
          <View style={styles.stageGrid}>
            {LIFE_STAGES.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[styles.stageCard, stage?.id === item.id && styles.stageCardSelected]}
                onPress={() => setStage(item)}
              >
                <Text style={styles.stageIcon}>{item.icon}</Text>
                <Text style={[styles.stageLabel, stage?.id === item.id && styles.stageLabelSelected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Goal */}
        <View style={styles.profileSection}>
          <Text style={styles.profileLabel}>What's your #1 financial goal right now?</Text>
          <View style={styles.goalList}>
            {GOALS.map(g => (
              <TouchableOpacity
                key={g}
                style={[styles.goalRow, goal === g && styles.goalRowSelected]}
                onPress={() => setGoal(g)}
              >
                <View style={[styles.goalRadio, goal === g && styles.goalRadioFilled]}>
                  {goal === g && <View style={styles.goalRadioDot} />}
                </View>
                <Text style={[styles.goalText, goal === g && styles.goalTextSelected]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.nextBtn, !canContinue && styles.nextBtnDisabled]}
          onPress={() => canContinue && onNext({ name: name.trim(), age, stage, goal })}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>Continue →</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Step 1: Choose your path ─────────────────────────────────────────────────

function PathSelectStep({ onSelect, name }) {
  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Text style={styles.stepLabel}>Hey {name} 👋</Text>
        <Text style={styles.title}>How would you like to set up your budget?</Text>
        <Text style={styles.subtitle}>
          We'll recommend a budgeting method that fits your life.
        </Text>
      </View>

      <View style={styles.pathCards}>
        <TouchableOpacity
          style={styles.pathCard}
          onPress={() => onSelect('knowledgeable')}
          activeOpacity={0.85}
        >
          <Text style={styles.pathIcon}>💡</Text>
          <Text style={styles.pathTitle}>I know what I want</Text>
          <Text style={styles.pathDesc}>
            Answer a few financial questions and we'll match you to the right method.
          </Text>
          <View style={styles.pathArrow}>
            <Text style={styles.pathArrowText}>→</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pathCard, styles.pathCardAlt]}
          onPress={() => onSelect('unsure')}
          activeOpacity={0.85}
        >
          <Text style={styles.pathIcon}>🤔</Text>
          <Text style={styles.pathTitle}>Help me decide</Text>
          <Text style={styles.pathDesc}>
            Not sure? Answer some lighter questions about your lifestyle instead.
          </Text>
          <View style={[styles.pathArrow, styles.pathArrowAlt]}>
            <Text style={styles.pathArrowText}>→</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Step 2: Questions ────────────────────────────────────────────────────────

function QuestionsStep({ path, onComplete }) {
  const questions = path === 'knowledgeable' ? knowledgeableQuestions : unsureQuestions;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selected, setSelected] = useState(null);

  const currentQ = questions[currentIndex];
  const progress = (currentIndex + 1) / questions.length;

  const handleNext = () => {
    const newAnswers = [...answers, selected];
    if (currentIndex < questions.length - 1) {
      setAnswers(newAnswers);
      setSelected(null);
      setCurrentIndex(i => i + 1);
    } else {
      onComplete(newAnswers);
    }
  };

  return (
    <View style={styles.container}>
      {/* Progress */}
      <View style={styles.progressHeader}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {currentIndex + 1} of {questions.length}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.questionScroll}>
        <Text style={styles.questionText}>{currentQ.question}</Text>

        <View style={styles.options}>
          {currentQ.options.map(option => (
            <TouchableOpacity
              key={option.id}
              style={[styles.optionCard, selected?.id === option.id && styles.optionSelected]}
              onPress={() => setSelected(option)}
              activeOpacity={0.8}
            >
              <View style={[styles.optionRadio, selected?.id === option.id && styles.optionRadioFilled]}>
                {selected?.id === option.id && <View style={styles.optionRadioDot} />}
              </View>
              <Text style={[styles.optionText, selected?.id === option.id && styles.optionTextSelected]}>
                {option.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, !selected && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!selected}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>
            {currentIndex < questions.length - 1 ? 'Next' : 'See my result'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Step 3: Result ───────────────────────────────────────────────────────────

function ResultStep({ method, path, profile, onComplete }) {
  const total = method.starterPockets.reduce((sum, p) => sum + p.budget, 0);

  return (
    <ScrollView style={styles.resultContainer} showsVerticalScrollIndicator={false}>

      <View style={styles.resultHero}>
        <Text style={styles.resultEmoji}>{method.icon}</Text>
        <Text style={styles.resultLabel}>Your budgeting method</Text>
        <Text style={[styles.resultName, { color: method.color }]}>{method.name}</Text>
        <Text style={styles.resultTagline}>{method.tagline}</Text>
      </View>

      <View style={styles.resultCard}>
        <Text style={styles.resultCardTitle}>How it works</Text>
        <Text style={styles.resultCardText}>{method.explanation}</Text>
      </View>

      {path === 'unsure' && (
        <View style={[styles.resultCard, styles.resultWhyCard]}>
          <Text style={styles.resultCardTitle}>Why this fits you</Text>
          <Text style={styles.resultCardText}>{method.whyYou}</Text>
        </View>
      )}

      <Text style={styles.pocketsTitle}>Your starter pockets</Text>
      <Text style={styles.pocketsSubtitle}>
        These will be created automatically. You can edit or add more anytime.
      </Text>

      {method.starterPockets.map((pocket, index) => {
        const pct = Math.round((pocket.budget / total) * 100);
        return (
          <View key={index} style={styles.pocketRow}>
            <View style={[styles.pocketDot, { backgroundColor: pocket.color }]} />
            <View style={styles.pocketInfo}>
              <Text style={styles.pocketName}>{pocket.name}</Text>
              {pocket.note ? <Text style={styles.pocketNote}>{pocket.note}</Text> : null}
            </View>
            <View style={styles.pocketRight}>
              <Text style={[styles.pocketPct, { color: pocket.color }]}>{pct}%</Text>
              <Text style={styles.pocketBudget}>of balance</Text>
            </View>
          </View>
        );
      })}

      <TouchableOpacity
        style={[styles.startBtn, { backgroundColor: method.color }]}
        onPress={() => onComplete({ method, profile })}
        activeOpacity={0.85}
      >
        <Text style={styles.startBtnText}>Create my pockets →</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Main OnboardingFlow ──────────────────────────────────────────────────────

export default function OnboardingFlow({ onComplete }) {
  const [step, setStep] = useState('profile');
  const [profile, setProfile] = useState(null);
  const [path, setPath] = useState(null);
  const [method, setMethod] = useState(null);

  const handleProfileNext = (profileData) => {
    setProfile(profileData);
    setStep('pathSelect');
  };

  const handlePathSelect = (selectedPath) => {
    setPath(selectedPath);
    setStep('questions');
  };

  const handleQuestionsComplete = (answers) => {
    const recommended = determineMethod(answers);
    setMethod(recommended);
    setStep('result');
  };

  if (step === 'profile') {
    return <ProfileStep onNext={handleProfileNext} />;
  }
  if (step === 'pathSelect') {
    return <PathSelectStep onSelect={handlePathSelect} name={profile?.name} />;
  }
  if (step === 'questions') {
    return <QuestionsStep path={path} onComplete={handleQuestionsComplete} />;
  }
  return <ResultStep method={method} path={path} profile={profile} onComplete={onComplete} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },

  // Profile step
  profileSection: { paddingHorizontal: 24, marginBottom: 24 },
  profileLabel: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 12 },
  profileInput: {
    backgroundColor: '#151F32', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#FFFFFF',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#151F32', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  chipSelected: { backgroundColor: '#0D2820', borderColor: '#00D4AA' },
  chipText: { fontSize: 13, color: '#8899AA', fontWeight: '500' },
  chipTextSelected: { color: '#00D4AA', fontWeight: '700' },

  stageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stageCard: {
    width: (width - 68) / 2, backgroundColor: '#151F32', borderRadius: 14,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  stageCardSelected: { borderColor: '#00D4AA', backgroundColor: '#0D2820' },
  stageIcon: { fontSize: 24, marginBottom: 6 },
  stageLabel: { fontSize: 13, color: '#8899AA', fontWeight: '500', textAlign: 'center' },
  stageLabelSelected: { color: '#FFFFFF', fontWeight: '700' },

  goalList: { gap: 8 },
  goalRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#151F32', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  goalRowSelected: { borderColor: '#00D4AA', backgroundColor: '#0D2820' },
  goalRadio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: '#4A5E78', marginRight: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  goalRadioFilled: { borderColor: '#00D4AA' },
  goalRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#00D4AA' },
  goalText: { flex: 1, fontSize: 14, color: '#8899AA' },
  goalTextSelected: { color: '#FFFFFF', fontWeight: '500' },

  // Path select
  topSection: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 32 },
  stepLabel: { fontSize: 12, fontWeight: '700', color: '#00D4AA', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 10 },
  subtitle: { fontSize: 15, color: '#8899AA', lineHeight: 22 },

  pathCards: { paddingHorizontal: 24, gap: 16 },
  pathCard: {
    backgroundColor: '#151F32', borderRadius: 20, padding: 22,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  pathCardAlt: { borderColor: 'rgba(255,255,255,0.1)' },
  pathIcon: { fontSize: 28, marginBottom: 12 },
  pathTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  pathDesc: { fontSize: 14, color: '#8899AA', lineHeight: 20, marginBottom: 16 },
  pathArrow: {
    alignSelf: 'flex-start', backgroundColor: '#00D4AA',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
  },
  pathArrowAlt: { backgroundColor: '#1C2B45' },
  pathArrowText: { fontSize: 16, color: '#0B1120', fontWeight: '700' },

  // Questions
  progressHeader: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  progressBg: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2, overflow: 'hidden', marginBottom: 8,
  },
  progressFill: { height: 4, backgroundColor: '#00D4AA', borderRadius: 2 },
  progressText: { fontSize: 12, color: '#8899AA', textAlign: 'right' },
  questionScroll: { flex: 1, paddingHorizontal: 24 },
  questionText: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', lineHeight: 30, marginBottom: 28 },

  options: { gap: 12, paddingBottom: 24 },
  optionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#151F32', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  optionSelected: { borderColor: '#00D4AA', backgroundColor: '#0D2820' },
  optionRadio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: '#4A5E78', marginRight: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  optionRadioFilled: { borderColor: '#00D4AA' },
  optionRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#00D4AA' },
  optionText: { flex: 1, fontSize: 15, color: '#8899AA', lineHeight: 22 },
  optionTextSelected: { color: '#FFFFFF', fontWeight: '500' },

  footer: { paddingHorizontal: 24, paddingVertical: 16 },
  nextBtn: {
    backgroundColor: '#00D4AA', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
  },
  nextBtnDisabled: { backgroundColor: '#1C2B45' },
  nextBtnText: { fontSize: 15, fontWeight: '700', color: '#0B1120' },

  // Result
  resultContainer: { flex: 1, backgroundColor: '#0B1120' },
  resultHero: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24, paddingBottom: 32 },
  resultEmoji: { fontSize: 52, marginBottom: 16 },
  resultLabel: { fontSize: 12, fontWeight: '700', color: '#8899AA', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  resultName: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6, textAlign: 'center' },
  resultTagline: { fontSize: 15, color: '#8899AA', textAlign: 'center' },

  resultCard: {
    marginHorizontal: 20, backgroundColor: '#151F32', borderRadius: 16,
    padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 12,
  },
  resultWhyCard: { borderColor: 'rgba(0,212,170,0.2)', backgroundColor: '#0D2820' },
  resultCardTitle: { fontSize: 13, fontWeight: '700', color: '#8899AA', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  resultCardText: { fontSize: 14, color: '#FFFFFF', lineHeight: 22 },

  pocketsTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginHorizontal: 20, marginTop: 24, marginBottom: 4 },
  pocketsSubtitle: { fontSize: 13, color: '#8899AA', marginHorizontal: 20, marginBottom: 14 },

  pocketRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  pocketDot: { width: 12, height: 12, borderRadius: 6, marginRight: 14 },
  pocketInfo: { flex: 1 },
  pocketName: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  pocketNote: { fontSize: 12, color: '#8899AA', marginTop: 1 },
  pocketRight: { alignItems: 'flex-end' },
  pocketPct: { fontSize: 16, fontWeight: '800' },
  pocketBudget: { fontSize: 11, color: '#4A5E78', marginTop: 1 },

  startBtn: {
    marginHorizontal: 20, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginTop: 28,
  },
  startBtnText: { fontSize: 15, fontWeight: '700', color: '#0B1120' },
});
