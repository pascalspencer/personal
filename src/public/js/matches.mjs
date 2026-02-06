function determinePercentage(selectedNumber, tickHistory, lastValue) {
  if (!tickHistory || tickHistory.length === 0) {
    let base = 10;
    if (lastValue !== null) {
      // If no data, jitter a bit to avoid similarity
      base = lastValue > 50 ? 55 : 45;
      base += (Math.random() * 4) - 2;
    }
    return { matches: base, differs: 100 - base };
  }

  const count = tickHistory.filter(d => d === selectedNumber).length;
  const frequency = (count / tickHistory.length) * 100;

  // Base chances from real data
  let matches = frequency;

  // Add allowance for variations and deviations (±6% swing for better lean)
  let deviation = (Math.random() * 12) - 6;

  // Ensure we don't end up with the same value as before
  if (lastValue !== null && Math.abs((matches + deviation) - lastValue) < 3) {
    deviation += deviation > 0 ? 4 : -4;
  }

  matches = Math.max(1, Math.min(99, matches + deviation));

  // Never 50/50
  if (Math.abs(matches - 50) < 1) {
    matches += matches >= 50 ? 2 : -2;
  }

  const differs = 100 - matches;
  return { matches, differs };
}

function determineChances(selectedNumber, tickHistory, lastValue) {
  const { matches, differs } = determinePercentage(selectedNumber, tickHistory, lastValue);

  let matchesChance = Math.floor(matches);
  let differsChance = 100 - matchesChance;

  // Final catch for 50/50 after flooring
  if (matchesChance === 50) {
    matchesChance = 51;
    differsChance = 49;
  }

  return { matchesChance, differsChance };
}

export { determineChances };
