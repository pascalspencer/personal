function calculateEvenOddChances(tickHistory, lastValue) {
    if (!tickHistory || tickHistory.length === 0) {
        let base = 50;
        if (lastValue !== null) {
            base = lastValue > 50 ? 55 : 45;
            base += (Math.random() * 4) - 2;
        } else {
            base = 52; // Default lean
        }
        return { evenChance: base, oddChance: 100 - base };
    }

    const evenCount = tickHistory.filter(d => d % 2 === 0).length;
    const oddCount = tickHistory.filter(d => d % 2 !== 0).length;
    const total = tickHistory.length || 1;

    let even = (evenCount / total) * 100;

    // Add allowance for variations and deviations
    let deviation = (Math.random() * 12) - 6;

    // Ensure variation from previous
    if (lastValue !== null && Math.abs((even + deviation) - lastValue) < 3) {
        deviation += deviation > 0 ? 5 : -5;
    }

    even = Math.max(1, Math.min(99, even + deviation));

    // Avoid 50/50
    if (Math.abs(even - 50) < 1) {
        even += even >= 50 ? 2 : -2;
    }

    let evenChance = Math.floor(even);
    if (evenChance === 50) evenChance = 51;
    let oddChance = 100 - evenChance;

    return { evenChance, oddChance };
}

export { calculateEvenOddChances };
