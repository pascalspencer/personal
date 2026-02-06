function determinePercentage(selectedNumber, tickHistory) {
  if (!tickHistory || tickHistory.length === 0) {
    return { matches: 10, differs: 90 };
  }

  const count = tickHistory.filter(d => d === selectedNumber).length;
  const frequency = (count / tickHistory.length) * 100;

  // Base chances from real data
  let matches = frequency;
  let differs = 100 - frequency;

  // Add allowance for variations and deviations (±5% swing)
  const deviation = (Math.random() * 10) - 5;
  matches = Math.max(1, Math.min(99, matches + deviation));
  differs = 100 - matches;

  return { matches, differs };
}

function determineChances(selectedNumber, tickHistory) {
  const { matches, differs } = determinePercentage(selectedNumber, tickHistory);

  const matchesChance = Math.floor(matches);
  const differsChance = Math.ceil(differs); // Ensure differs is the complement

  return { matchesChance, differsChance };
}

export { determineChances };
