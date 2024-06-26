const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// Constants
const MAX_PERCENTAGE = 93;
const MATCH_CHANCE_FREQUENCY = 2 / 11; // Probability of high match chance
const RANDOM_DEVIATION_CHANCE = 0.2;
const GENERAL_DEVIATION_CHANCE = 0.1;
const DEVIATION_BASE = 90.0;
const DEVIATION_RANGE = 35.0;
const RANDOM_FREQUENCY_MIN = 8.0;
const RANDOM_FREQUENCY_RANGE = 5.0;

function determineBaseChances(selectedNumber) {
  const totalNumbers = numbers.length; // total numbers from 0 to 9
  const chance = 100 / totalNumbers;

  let higherChance, lowerChance;

  // Calculate chances based on selectedNumber
  higherChance = lowerChance = chance;

  return { higherChance, lowerChance };
}

function applyRandomDeviation(higherChance, lowerChance, selectedNumber) {
  if (
    Math.random() < RANDOM_DEVIATION_CHANCE &&
    selectedNumber > Math.min(...numbers) &&
    selectedNumber < Math.max(...numbers)
  ) {
    const increaseAmount = Math.random() * 10; // Increase by up to 10%
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

  // Ensure bounds are respected
  higherChance = Math.min(higherChance, MAX_PERCENTAGE);
  lowerChance = Math.max(lowerChance, 0);

  // Generate a random frequency between RANDOM_FREQUENCY_MIN and (RANDOM_FREQUENCY_MIN + RANDOM_FREQUENCY_RANGE)
  const randomFrequency =
    Math.random() * RANDOM_FREQUENCY_RANGE + RANDOM_FREQUENCY_MIN;

  // Multiply the chosen percentage by the random frequency
  const differs = higherChance * randomFrequency;
  let matches = lowerChance * randomFrequency;

  // Adjust match chance to be higher when deviation occurs
  if (
    Math.random() < RANDOM_DEVIATION_CHANCE &&
    selectedNumber > Math.min(...numbers) &&
    selectedNumber < Math.max(...numbers)
  ) {
    matches *= 2; // Increase match chance significantly during deviation
  } else {
    // Adjust match chance to be low most of the time
    if (Math.random() >= MATCH_CHANCE_FREQUENCY) {
      matches *= 0.1; // Reduce match chance significantly
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

// Export a function to determine the chances
function determineChances(selectedNumber) {
    const { matches, differs } = determinePercentage(selectedNumber);

    // Determine total chance
    const totalChance = matches + differs;

    // Determine matchesChance and differsChance percentages
    const matchesChance = Math.floor((matches / totalChance) * 97);
    const differsChance = Math.floor((differs / totalChance) * 97);

    return { matchesChance, differsChance };
  }

export { determineChances };