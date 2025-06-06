module.exports = {
  ci: {
    collect: {
      url: ['/'],
      numberOfRuns: 3,
      settings: { emulatedFormFactor: 'mobile' },
    },
    assert: {
      assertions: {
        'interactive': ['error', { maxNumericValue: 1000 }],
        'first-contentful-paint': ['error', { maxNumericValue: 800 }],
        'mainthread-work-breakdown': ['error', { maxNumericValue: 1000 }],
      },
    },
  },
};
