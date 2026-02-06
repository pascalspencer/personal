const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function calculateChances(selectedNumber, tickHistory) {
  if (!tickHistory || tickHistory.length === 0) {
    return { overChance: 50, underChance: 50 };
  }

  const overCount = tickHistory.filter(d => d > selectedNumber).length;
  const underCount = tickHistory.filter(d => d < selectedNumber).length;
  const totalRelevant = (overCount + underCount) || 1;

  let over = (overCount / totalRelevant) * 100;
  let under = (underCount / totalRelevant) * 100;

  // Add allowance for variations and deviations (±5% swing)
  const deviation = (Math.random() * 10) - 5;
  over = Math.max(1, Math.min(99, over + deviation));
  under = 100 - over;

  return {
    overChance: Math.floor(over),
    underChance: Math.floor(under)
  };
}

export { calculateChances };