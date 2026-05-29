export const TEMPLATES = {
  fifty_thirty_twenty: {
    id: 'fifty_thirty_twenty',
    name: '50 / 30 / 20',
    tagline: 'Simple, balanced, effective.',
    icon: '⚖️',
    color: '#00D4AA',
    description: 'Half for essentials, a third for fun, a fifth for savings.',
    pockets: () => [
      { name: 'Needs',   color: '#00D4AA', income_percent: 50 },
      { name: 'Wants',   color: '#FF9F43', income_percent: 30 },
      { name: 'Savings', color: '#B39DDB', income_percent: 20 },
    ],
  },

  save_first: {
    id: 'save_first',
    name: 'Save First',
    tagline: 'Savings happen before anything else.',
    icon: '🏦',
    color: '#B39DDB',
    description: 'Pay yourself first, then spend the rest however you like.',
    pockets: () => [
      { name: 'Savings',      color: '#B39DDB', income_percent: 20 },
      { name: 'Free Spending',color: '#00D4AA', income_percent: 80 },
    ],
  },

  zero_based: {
    id: 'zero_based',
    name: 'Zero-Based',
    tagline: 'Every dollar has a job.',
    icon: '🎯',
    color: '#448AFF',
    description: 'Assign every dollar to a category. Full visibility, full control.',
    pockets: () => [
      { name: 'Housing',   color: '#FF5252', income_percent: 35 },
      { name: 'Food',      color: '#00D4AA', income_percent: 15 },
      { name: 'Transport', color: '#448AFF', income_percent: 10 },
      { name: 'Savings',   color: '#B39DDB', income_percent: 20 },
      { name: 'Fun',       color: '#FF9F43', income_percent: 10 },
      { name: 'Other',     color: '#8899AA', income_percent: 10 },
    ],
  },

  blank: {
    id: 'blank',
    name: 'Start Blank',
    tagline: 'Build from scratch.',
    icon: '✏️',
    color: '#8899AA',
    description: 'No starter pockets. Create exactly what you need.',
    pockets: () => [],
  },
};
