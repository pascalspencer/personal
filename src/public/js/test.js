function calculatePercentages() {
  const percentages = [];
  const divElements = resultsContainer.getElementsByTagName("div");

  for (let i = 0; i < 2 && i < divElements.length; i++) {
    const textContent = divElements[i].textContent;
    const percentageMatch = textContent.match(/\((\d+)%\)/);
    if (percentageMatch) {
      percentages.push(parseInt(percentageMatch[1], 10));
    }
  }

  return percentages;
}
