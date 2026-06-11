// This file defines the four budgeting templates users can choose from during onboarding.
// TEMPLATES is an object (not an array) so each template can be looked up by ID:
//   TEMPLATES['fifty_thirty_twenty']   → the 50/30/20 template
//   TEMPLATES[settings.method_id]      → any template by its saved ID
//
// Why is pockets a function (not an array)?
//   Each call to pockets() returns a FRESH array. If it were a plain array, all users
//   who pick the same template would share the same objects in memory, which could
//   cause bugs when one user's data accidentally modifies another's.

export const TEMPLATES = {
  fifty_thirty_twenty: {
    id: 'fifty_thirty_twenty',
    name: '50 / 30 / 20',
    tagline: 'Simple, balanced, effective.',
    icon: '⚖️',
    color: '#00D4AA',
    description: 'Half for essentials, a third for fun, a fifth for savings.',
    // income_percent tells the inbox how to split an incoming paycheck:
    // 50% goes to Needs, 30% to Wants, 20% to Savings.
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
      { name: 'Savings',       color: '#B39DDB', income_percent: 20 },
      { name: 'Free Spending', color: '#00D4AA', income_percent: 80 },
    ],
  },

  zero_based: {
    id: 'zero_based',
    name: 'Zero-Based',
    tagline: 'Every dollar has a job.',
    icon: '🎯',
    color: '#448AFF',
    description: 'Assign every dollar to a category. Full visibility, full control.',
    // The percentages here total 100 so every dollar of income gets a destination.
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
    // Returns an empty array — the blank template shows the SetupPocketsStep
    // in onboarding so the user can manually create their own pockets.
    pockets: () => [],
  },
};
