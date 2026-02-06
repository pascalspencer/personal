const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function calculateChances(selectedNumber, tickHistory, lastValue) {
  if (!tickHistory || tickHistory.length === 0) {
    let base = 50;
    if (lastValue !== null) {
      base = lastValue > 50 ? 55 : 45;
      base += (Math.random() * 4) - 2;
    } else {
      base = 52; // Default lean
    }
    return { overChance: base, underChance: 100 - base };
  }

  const overCount = tickHistory.filter(d => d > selectedNumber).length;
  const underCount = tickHistory.filter(d => d < selectedNumber).length;
  const totalRelevant = (overCount + underCount) || 1;

  let over = (overCount / totalRelevant) * 100;

  // Add allowance for variations and deviations
  let deviation = (Math.random() * 12) - 6;

  // Ensure variation from previous
  if (lastValue !== null && Math.abs((over + deviation) - lastValue) < 3) {
    deviation += deviation > 0 ? 5 : -5;
  }

  over = Math.max(1, Math.min(99, over + deviation));

  // Avoid 50/50
  if (Math.abs(over - 50) < 1) {
    over += over >= 50 ? 2 : -2;
  }

  let overChance = Math.floor(over);
  if (overChance === 50) overChance = 51;
  let underChance = 100 - overChance;

  return { overChance, underChance };
}

export { calculateChances };