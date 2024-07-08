const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function calculateChances(selectedNumber) {
    const { over, under } = calculatePercentageDigit(selectedNumber);

    const totalChanceDigit = over + under;
    const overChance = Math.floor((over / totalChanceDigit) * 97);
    const underChance = Math.floor((under / totalChanceDigit) * 97);

    return { overChance, underChance };
  }

  // Deviation frequencies for specific numbers
  const deviationFrequenciesDigits = {
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 4,
    6: 3,
    7: 2,
    8: 1,
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
      higherChanceDigit = Math.min(
        ((max - selectedNumber) / (max - min)) * 100,
        MAX_PERCENTAGE_DIGIT
      );
      lowerChanceDigit = Math.min(
        ((selectedNumber - min) / (max - min)) * 100,
        MAX_PERCENTAGE_DIGIT
      );
    }

    return { higherChanceDigit, lowerChanceDigit };
  }

  function applyRandomDeviationDigit(
    higherChanceDigit,
    lowerChanceDigit,
    selectedNumber
  ) {
    if (
      Math.random() < RANDOM_DEVIATION_CHANCE_DIGIT &&
      selectedNumber > 1 &&
      selectedNumber < 9
    ) {
      const increaseAmountDigit = Math.random() * 10;
      higherChanceDigit = Math.min(
        higherChanceDigit + increaseAmountDigit,
        MAX_PERCENTAGE_DIGIT
      );
      lowerChanceDigit = Math.max(lowerChanceDigit - increaseAmountDigit, 0);
    }
    return { higherChanceDigit, lowerChanceDigit };
  }

  function applyFrequencyDeviationDigit(
    higherChanceDigit,
    lowerChanceDigit,
    selectedNumber
  ) {
    const deviationFrequencyDigit =
      deviationFrequenciesDigits[selectedNumber] || 1;

    if (Math.random() < deviationFrequencyDigit / 10) {
      const deviationAmountDigit =
        DEVIATION_BASE_DIGIT + Math.random() * DEVIATION_RANGE_DIGIT;
      higherChanceDigit = deviationAmountDigit;
      lowerChanceDigit = MAX_PERCENTAGE_DIGIT - higherChanceDigit;
    }

    higherChanceDigit = Math.min(higherChanceDigit, MAX_PERCENTAGE_DIGIT);
    lowerChanceDigit = Math.max(lowerChanceDigit, 0);

    return { higherChanceDigit, lowerChanceDigit };
  }

  function calculatePercentageDigit(selectedNumber) {
    const max = Math.max(...numbers);
    const min = Math.min(...numbers);

    let { higherChanceDigit, lowerChanceDigit } = calculateBaseChances(
      selectedNumber,
      max,
      min
    );
    ({ higherChanceDigit, lowerChanceDigit } = applyRandomDeviationDigit(
      higherChanceDigit,
      lowerChanceDigit,
      selectedNumber
    ));
    ({ higherChanceDigit, lowerChanceDigit } = applyFrequencyDeviationDigit(
      higherChanceDigit,
      lowerChanceDigit,
      selectedNumber
    ));

    const randomFrequencyDigit =
      Math.random() * RANDOM_FREQUENCY_RANGE_DIGIT + RANDOM_FREQUENCY_MIN_DIGIT;
    const over = higherChanceDigit * randomFrequencyDigit;
    const under = lowerChanceDigit * randomFrequencyDigit;

    return {
      higherChanceDigit,
      lowerChanceDigit,
      randomFrequencyDigit,
      over,
      under,
    };
  }

  export { calculateChances };