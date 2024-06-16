const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// Deviation frequencies for specific numbers
const deviationFrequenciesDigits = {
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
const MAX_PERCENTAGE_DIGIT = 93;
const DEVIATION_BASE_DIGIT = 50.0;
const DEVIATION_RANGE_DIGIT = 35.0;
const RANDOM_FREQUENCY_MIN_DIGIT = 7.0;
const RANDOM_FREQUENCY_RANGE_DIGIT = 6.0;
const RANDOM_DEVIATION_CHANCE_DIGIT = 0.2;

function calculateBaseChances(selectedNumber, max, min) {
    let higherChanceDigit, lowerChanceDigit;

    if (selectedNumber === max || selectedNumber === 9) {
        higherChanceDigit = 0;
        lowerChanceDigit = MAX_PERCENTAGE_DIGIT;
    } else if (selectedNumber === min || selectedNumber === 0) {
        higherChanceDigit = MAX_PERCENTAGE_DIGIT;
        lowerChanceDigit = 0;
    } else {
        higherChanceDigit = Math.min(((max - selectedNumber) / (max - min)) * 100, MAX_PERCENTAGE_DIGIT);
        lowerChanceDigit = Math.min(((selectedNumber - min) / (max - min)) * 100, MAX_PERCENTAGE_DIGIT);
    }

    return { higherChanceDigit, lowerChanceDigit };
}

function applyRandomDeviation(higherChanceDigit, lowerChanceDigit, selectedNumber) {
    if (Math.random() < RANDOM_DEVIATION_CHANCE_DIGIT && selectedNumber > 1 && selectedNumber < 9) {
        const increaseAmount = Math.random() * 10;
        higherChanceDigit = Math.min(higherChanceDigit + increaseAmount, MAX_PERCENTAGE_DIGIT);
        lowerChanceDigit = Math.max(lowerChanceDigit - increaseAmount, 0);
    }
    return { higherChanceDigit, lowerChanceDigit };
}

function applyFrequencyDeviation(higherChanceDigit, lowerChanceDigit, selectedNumber) {
    const deviationFrequencyDigit = deviationFrequenciesDigits[selectedNumber] || 1;

    if (Math.random() < (deviationFrequencyDigit / 10)) {
        const deviationAmountDigit = DEVIATION_BASE_DIGIT + (Math.random() * DEVIATION_RANGE_DIGIT);
        higherChanceDigit = deviationAmountDigit;
        lowerChanceDigit = MAX_PERCENTAGE_DIGIT - higherChanceDigit;
    }

    higherChanceDigit = Math.min(higherChanceDigit, MAX_PERCENTAGE_DIGIT);
    lowerChanceDigit = Math.max(lowerChanceDigit, 0);

    return { higherChanceDigit, lowerChanceDigit };
}

function calculatePercentage(selectedNumber) {
    const max = Math.max(...numbers);
    const min = Math.min(...numbers);

    let { higherChanceDigit, lowerChanceDigit } = calculateBaseChances(selectedNumber, max, min);
    ({ higherChanceDigit, lowerChanceDigit } = applyRandomDeviation(higherChanceDigit, lowerChanceDigit, selectedNumber));
    ({ higherChanceDigit, lowerChanceDigit } = applyFrequencyDeviation(higherChanceDigit, lowerChanceDigit, selectedNumber));

    const randomFrequency = Math.random() * RANDOM_FREQUENCY_RANGE_DIGIT + RANDOM_FREQUENCY_MIN_DIGIT;
    const over = higherChanceDigit * randomFrequency;
    const under = lowerChanceDigit * randomFrequency;

    return {
        higherChanceDigit,
        lowerChanceDigit,
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

