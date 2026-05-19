// ─── Budgeting methods ───────────────────────────────────────────────────────

export const METHODS = {
  FIFTY_THIRTY_TWENTY: {
    id: 'FIFTY_THIRTY_TWENTY',
    name: '50/30/20 Rule',
    tagline: 'Simple, balanced, effective.',
    icon: '⚖️',
    color: '#00D4AA',
    explanation:
      "Split your income into 3 buckets — 50% for needs, 30% for wants, and 20% for savings. It's easy to follow and covers everything without obsessing over every dollar.",
    whyYou:
      "You want a clear structure that's simple enough to actually stick to. This gives you that balance without overwhelming you.",
    starterPockets: [
      { name: 'Needs',   color: '#00D4AA', budget: 2500, note: '50% — rent, groceries, bills' },
      { name: 'Wants',   color: '#FF9F43', budget: 1500, note: '30% — dining, fun, shopping' },
      { name: 'Savings', color: '#B39DDB', budget: 1000, note: '20% — emergency fund, goals' },
    ],
  },

  ZERO_BASED: {
    id: 'ZERO_BASED',
    name: 'Zero-Based Budgeting',
    tagline: 'Every dollar has a job.',
    icon: '🎯',
    color: '#448AFF',
    explanation:
      "You assign every single dollar a purpose until you hit zero. You're not spending zero — you're giving every dollar a job, whether that's bills, savings, or fun.",
    whyYou:
      "You like being in full control and knowing exactly where everything goes. This method is built for people like you.",
    starterPockets: [
      { name: 'Housing',     color: '#FF5252', budget: 1500, note: 'Rent / mortgage' },
      { name: 'Food',        color: '#00D4AA', budget: 500,  note: 'Groceries + dining' },
      { name: 'Transport',   color: '#448AFF', budget: 300,  note: 'Gas, transit, car' },
      { name: 'Savings',     color: '#B39DDB', budget: 800,  note: 'Emergency + goals' },
      { name: 'Fun',         color: '#FF9F43', budget: 400,  note: 'Entertainment, hobbies' },
      { name: 'Everything Else', color: '#8899AA', budget: 500, note: 'Catch-all' },
    ],
  },

  ENVELOPE: {
    id: 'ENVELOPE',
    name: 'Envelope Method',
    tagline: 'Cash in, cash out — you stay accountable.',
    icon: '✉️',
    color: '#FF9F43',
    explanation:
      "You divide your money into separate pockets for each spending category. Once a pocket is empty, you're done spending in that category for the month.",
    whyYou:
      "You know you overspend in certain areas and want clear limits. Having separate pockets makes it obvious when you're close to the edge.",
    starterPockets: [
      { name: 'Groceries',    color: '#00D4AA', budget: 400, note: 'Weekly food shop' },
      { name: 'Dining Out',   color: '#FF9F43', budget: 200, note: 'Restaurants, takeout' },
      { name: 'Transport',    color: '#448AFF', budget: 250, note: 'Gas, transit' },
      { name: 'Entertainment',color: '#B39DDB', budget: 150, note: 'Streaming, events' },
      { name: 'Personal',     color: '#FF5252', budget: 100, note: 'Clothes, self-care' },
      { name: 'Savings',      color: '#8BC34A', budget: 500, note: 'Future you' },
    ],
  },

  PAY_YOURSELF_FIRST: {
    id: 'PAY_YOURSELF_FIRST',
    name: 'Pay Yourself First',
    tagline: 'Savings happen before anything else.',
    icon: '🏦',
    color: '#B39DDB',
    explanation:
      "The moment money comes in, savings come out first. Whatever's left is yours to spend however you want — no guilt, no tracking every dollar.",
    whyYou:
      "You want to build savings consistently without having to think about it every month. Set it up once and it runs itself.",
    starterPockets: [
      { name: 'Savings First', color: '#B39DDB', budget: 1000, note: 'Transferred out immediately' },
      { name: 'Rent / Housing',color: '#FF5252', budget: 1500, note: 'Fixed monthly cost' },
      { name: 'Daily Life',    color: '#00D4AA', budget: 1500, note: 'Food, transport, bills' },
      { name: 'Free Spending', color: '#FF9F43', budget: 1000, note: 'No rules, enjoy it' },
    ],
  },

  EIGHTY_TWENTY: {
    id: 'EIGHTY_TWENTY',
    name: '80/20 Rule',
    tagline: 'Save 20%, enjoy the rest.',
    icon: '✌️',
    color: '#8BC34A',
    explanation:
      "Put 20% away into savings the moment you get paid. The other 80% is yours to spend however feels right — no categories, no tracking, no stress.",
    whyYou:
      "You're pretty relaxed about money but want to make sure you're at least saving something consistently. This is as low-effort as it gets.",
    starterPockets: [
      { name: 'Savings', color: '#8BC34A', budget: 1000, note: '20% — non-negotiable' },
      { name: 'Life',    color: '#00D4AA', budget: 4000, note: '80% — spend freely' },
    ],
  },

  VALUES_BASED: {
    id: 'VALUES_BASED',
    name: 'Values-Based Budgeting',
    tagline: 'Spend most on what matters most.',
    icon: '💛',
    color: '#FFD700',
    explanation:
      "You decide what you care about most — travel, family, health, experiences — and make sure your budget reflects that. Everything else gets what's left.",
    whyYou:
      "You're not trying to track every dollar. You just want your money to reflect what actually matters to you, not just go toward default expenses.",
    starterPockets: [
      { name: 'My #1 Priority', color: '#FFD700', budget: 1500, note: 'What matters most to you' },
      { name: 'Essentials',     color: '#00D4AA', budget: 2000, note: 'Rent, food, bills' },
      { name: 'Savings',        color: '#B39DDB', budget: 700,  note: 'Future security' },
      { name: 'Everything Else',color: '#8899AA', budget: 800,  note: 'The rest' },
    ],
  },

  LINE_ITEM: {
    id: 'LINE_ITEM',
    name: 'Line-Item Budgeting',
    tagline: 'Detailed, thorough, nothing hidden.',
    icon: '📋',
    color: '#FF5252',
    explanation:
      "Every expense gets its own line. You know exactly what every dollar is going toward — utilities, subscriptions, haircuts, all of it.",
    whyYou:
      "You want full visibility. No surprises, no mystery spending. You like knowing the complete picture.",
    starterPockets: [
      { name: 'Rent',          color: '#FF5252', budget: 1500, note: '' },
      { name: 'Groceries',     color: '#00D4AA', budget: 400,  note: '' },
      { name: 'Utilities',     color: '#448AFF', budget: 150,  note: '' },
      { name: 'Transport',     color: '#FF9F43', budget: 250,  note: '' },
      { name: 'Subscriptions', color: '#B39DDB', budget: 80,   note: '' },
      { name: 'Healthcare',    color: '#8BC34A', budget: 100,  note: '' },
      { name: 'Personal',      color: '#FFD700', budget: 150,  note: '' },
      { name: 'Savings',       color: '#8899AA', budget: 800,  note: '' },
    ],
  },
};

// ─── Questions ────────────────────────────────────────────────────────────────

export const knowledgeableQuestions = [
  {
    id: 'k1',
    question: 'How do you currently handle your money?',
    options: [
      { id: 'a', text: 'I have a rough system that mostly works',  methods: ['FIFTY_THIRTY_TWENTY', 'EIGHTY_TWENTY'] },
      { id: 'b', text: "I wing it — no real system",               methods: ['ENVELOPE', 'FIFTY_THIRTY_TWENTY'] },
      { id: 'c', text: "I've tried budgeting but it never sticks", methods: ['ENVELOPE', 'PAY_YOURSELF_FIRST'] },
      { id: 'd', text: "I'm starting fresh with nothing in place", methods: ['ZERO_BASED', 'LINE_ITEM'] },
    ],
  },
  {
    id: 'k2',
    question: 'How do you prefer to manage money?',
    options: [
      { id: 'a', text: 'Every dollar should have a job',    methods: ['ZERO_BASED'] },
      { id: 'b', text: 'A few broad categories is enough',  methods: ['FIFTY_THIRTY_TWENTY', 'EIGHTY_TWENTY'] },
      { id: 'c', text: 'Save first, spend the rest freely', methods: ['PAY_YOURSELF_FIRST', 'EIGHTY_TWENTY'] },
      { id: 'd', text: 'Based on what matters to me most',  methods: ['VALUES_BASED'] },
    ],
  },
  {
    id: 'k3',
    question: 'How hands-on do you want to be?',
    options: [
      { id: 'a', text: 'Very — I want full control',         methods: ['ZERO_BASED', 'LINE_ITEM'] },
      { id: 'b', text: 'Somewhat — check in once a week',    methods: ['ENVELOPE', 'FIFTY_THIRTY_TWENTY'] },
      { id: 'c', text: 'Minimal — set it and forget it',     methods: ['PAY_YOURSELF_FIRST', 'EIGHTY_TWENTY'] },
      { id: 'd', text: 'Just enough to stay on track',       methods: ['VALUES_BASED', 'FIFTY_THIRTY_TWENTY'] },
    ],
  },
];

export const unsureQuestions = [
  {
    id: 'u1',
    question: 'How would you describe your relationship with money?',
    options: [
      { id: 'a', text: 'I stress about it a lot 😬',            methods: ['ENVELOPE', 'FIFTY_THIRTY_TWENTY'] },
      { id: 'b', text: "Pretty relaxed — things work out 😌",   methods: ['EIGHTY_TWENTY', 'PAY_YOURSELF_FIRST'] },
      { id: 'c', text: 'I want to be more intentional with it', methods: ['VALUES_BASED', 'ZERO_BASED'] },
      { id: 'd', text: 'I avoid thinking about it honestly',     methods: ['FIFTY_THIRTY_TWENTY', 'EIGHTY_TWENTY'] },
    ],
  },
  {
    id: 'u2',
    question: "What's your biggest money struggle?",
    options: [
      { id: 'a', text: 'I overspend on things I regret',        methods: ['ENVELOPE', 'ZERO_BASED'] },
      { id: 'b', text: "Nothing's left at the end of the month", methods: ['PAY_YOURSELF_FIRST', 'ZERO_BASED'] },
      { id: 'c', text: "I have no idea where my money goes",    methods: ['LINE_ITEM', 'ZERO_BASED'] },
      { id: 'd', text: 'I know what to do but never do it',     methods: ['ENVELOPE', 'FIFTY_THIRTY_TWENTY'] },
    ],
  },
  {
    id: 'u3',
    question: 'What would make you feel good about your finances?',
    options: [
      { id: 'a', text: 'Having a solid savings cushion',         methods: ['PAY_YOURSELF_FIRST', 'FIFTY_THIRTY_TWENTY'] },
      { id: 'b', text: 'Spending freely on things I actually love', methods: ['VALUES_BASED', 'EIGHTY_TWENTY'] },
      { id: 'c', text: 'Knowing every dollar is accounted for',  methods: ['ZERO_BASED', 'LINE_ITEM'] },
      { id: 'd', text: 'Just feeling less stressed about money',  methods: ['ENVELOPE', 'FIFTY_THIRTY_TWENTY'] },
    ],
  },
];

// ─── Mapping function ─────────────────────────────────────────────────────────

export function determineMethod(answers) {
  const scores = {};
  answers.forEach(answer => {
    answer.methods.forEach(method => {
      scores[method] = (scores[method] || 0) + 1;
    });
  });
  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  return METHODS[winner];
}
