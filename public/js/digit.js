const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// Deviation frequencies for specific numbers
const deviationFrequencies = {
    1: 2,
    2: 3,
    3: 4,
    4: 5,
    5: 5,
    6: 4,
    7: 3,
    8: 2,
};

// Constants
const MAX_PERCENTAGE = 93;
const DEVIATION_BASE = 50.0;
const DEVIATION_RANGE = 35.0;
const RANDOM_FREQUENCY_MIN = 7.0;
const RANDOM_FREQUENCY_RANGE = 6.0;
const RANDOM_DEVIATION_CHANCE = 0.2;

function calculateBaseChances(selectedNumber, max, min) {
    let higherChance, lowerChance;

    if (selectedNumber === max || selectedNumber === 9) {
        higherChance = 0;
        lowerChance = MAX_PERCENTAGE;
    } else if (selectedNumber === min || selectedNumber === 0) {
        higherChance = MAX_PERCENTAGE;
        lowerChance = 0;
    } else {
        higherChance = Math.min(((max - selectedNumber) / (max - min)) * 100, MAX_PERCENTAGE);
        lowerChance = Math.min(((selectedNumber - min) / (max - min)) * 100, MAX_PERCENTAGE);
    }

    return { higherChance, lowerChance };
}

function applyRandomDeviation(higherChance, lowerChance, selectedNumber) {
    if (Math.random() < RANDOM_DEVIATION_CHANCE && selectedNumber > 1 && selectedNumber < 9) {
        const increaseAmount = Math.random() * 10;
        higherChance = Math.min(higherChance + increaseAmount, MAX_PERCENTAGE);
        lowerChance = Math.max(lowerChance - increaseAmount, 0);
    }
    return { higherChance, lowerChance };
}

function applyFrequencyDeviation(higherChance, lowerChance, selectedNumber) {
    const deviationFrequency = deviationFrequencies[selectedNumber] || 1;

    if (Math.random() < (deviationFrequency / 10)) {
        const deviationAmount = DEVIATION_BASE + (Math.random() * DEVIATION_RANGE);
        higherChance = deviationAmount;
        lowerChance = MAX_PERCENTAGE - higherChance;
    }

    higherChance = Math.min(higherChance, MAX_PERCENTAGE);
    lowerChance = Math.max(lowerChance, 0);

    return { higherChance, lowerChance };
}

function calculatePercentage(selectedNumber) {
    const max = Math.max(...numbers);
    const min = Math.min(...numbers);

    let { higherChance, lowerChance } = calculateBaseChances(selectedNumber, max, min);
    ({ higherChance, lowerChance } = applyRandomDeviation(higherChance, lowerChance, selectedNumber));
    ({ higherChance, lowerChance } = applyFrequencyDeviation(higherChance, lowerChance, selectedNumber));

    const randomFrequency = Math.random() * RANDOM_FREQUENCY_RANGE + RANDOM_FREQUENCY_MIN;
    const over = higherChance * randomFrequency;
    const under = lowerChance * randomFrequency;

    return {
        higherChance,
        lowerChance,
        randomFrequency,
        over,
        under
    };
}

function calculateChances(selectedNumber) {
    const { over, under } = calculatePercentage(selectedNumber);

    const totalChance = over + under;
    const overChance = ((over / totalChance) * 97).toFixed(2);
    const underChance = ((under / totalChance) * 97).toFixed(2);

    return { overChance, underChance };
}

// Export the function to calculate chances and use them in other modules
export { calculateChances };
