const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// Constants
const MAX_PERCENTAGE = 93;
const MATCH_CHANCE_FREQUENCY = 2 / 11; // Probability of high match chance
const DERIV_DEVIATION_CHANCE = 0.2;
const GENERAL_DEVIATION_CHANCE = 0.1;
const DEVIATION_BASE = 90.0;
const DEVIATION_RANGE = 35.0;
const DERIV_FREQUENCY_MIN = 8.0;
const DERIV_FREQUENCY_RANGE = 5.0;

function determineBaseChances(selectedNumber) {
  const totalNumbers = numbers.length; 
  const chance = 100 / totalNumbers;

  let higherChance, lowerChance;

  higherChance = lowerChance = chance;

  return { higherChance, lowerChance };
}

function applyRandomDeviation(higherChance, lowerChance, selectedNumber) {
  if (
    Math.random() < DERIV_DEVIATION_CHANCE &&
    selectedNumber > Math.min(...numbers) &&
    selectedNumber < Math.max(...numbers)
  ) {
    const increaseAmount = Math.random() * 10; 
    higherChance = Math.min(higherChance + increaseAmount, MAX_PERCENTAGE);
    lowerChance = Math.max(lowerChance - increaseAmount, 0);
  }
  return { higherChance, lowerChance };
}

function applyGeneralDeviation(higherChance, lowerChance) {
  if (Math.random() < GENERAL_DEVIATION_CHANCE) {
    const deviationAmount = DEVIATION_BASE + Math.random() * DEVIATION_RANGE;
    higherChance = deviationAmount;
    lowerChance = MAX_PERCENTAGE - higherChance;
  }
  return { higherChance, lowerChance };
}

function determinePercentage(selectedNumber) {
  let { higherChance, lowerChance } = determineBaseChances(selectedNumber);
  ({ higherChance, lowerChance } = applyRandomDeviation(
    higherChance,
    lowerChance,
    selectedNumber
  ));
  ({ higherChance, lowerChance } = applyGeneralDeviation(
    higherChance,
    lowerChance
  ));


  higherChance = Math.min(higherChance, MAX_PERCENTAGE);
  lowerChance = Math.max(lowerChance, 0);


  const randomFrequency =
    Math.random() * DERIV_FREQUENCY_RANGE + DERIV_FREQUENCY_MIN;


    const differs = higherChance * randomFrequency;
  let matches = lowerChance * randomFrequency;


  if (
    Math.random() < DERIV_DEVIATION_CHANCE &&
    selectedNumber > Math.min(...numbers) &&
    selectedNumber < Math.max(...numbers)
  ) {
    matches *= 2; 
  } else {
    if (Math.random() >= MATCH_CHANCE_FREQUENCY) {
      matches *= 0.1; 
    }
  }

  return {
    higherChance,
    lowerChance,
    randomFrequency,
    matches,
    differs,
  };
}


function determineChances(selectedNumber) {
    const { matches, differs } = determinePercentage(selectedNumber);

    const totalChance = matches + differs;

    const matchesChance = Math.floor((matches / totalChance) * 97);
    const differsChance = Math.floor((differs / totalChance) * 97);


    if (matchesChance === differsChance) {
      matchesChance += 1;
      if (matchesChance > 97) {
        matchesChance = 97;
      }
    }

    return { matchesChance, differsChance };
  }

export { determineChances };