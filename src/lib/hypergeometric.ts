function logFactorial(n: number): number {
  let sum = 0
  for (let i = 2; i <= n; i++) sum += Math.log(i)
  return sum
}

function logChoose(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k)
}

function pmf(populationSize: number, successStates: number, sampleSize: number, observed: number): number {
  const logP =
    logChoose(successStates, observed) +
    logChoose(populationSize - successStates, sampleSize - observed) -
    logChoose(populationSize, sampleSize)
  return Math.exp(logP)
}

/**
 * Probability of drawing at least `minSuccesses` copies of a card/group
 * when sampling `sampleSize` cards from a deck of `populationSize` that
 * contains `successStates` copies of it.
 */
export function atLeastProbability(
  populationSize: number,
  successStates: number,
  sampleSize: number,
  minSuccesses: number,
): number {
  if (successStates <= 0 || sampleSize <= 0 || populationSize <= 0) return 0
  const clampedSample = Math.min(sampleSize, populationSize)
  const maxObservable = Math.min(clampedSample, successStates)
  if (minSuccesses <= 0) return 1
  if (minSuccesses > maxObservable) return 0

  let cumulativeBelow = 0
  for (let k = 0; k < minSuccesses; k++) {
    cumulativeBelow += pmf(populationSize, successStates, clampedSample, k)
  }
  return Math.max(0, Math.min(1, 1 - cumulativeBelow))
}

export function drawsByTurn(turn: number, onThePlay: boolean, openingHand = 7): number {
  if (turn <= 0) return openingHand
  const extraDraws = onThePlay ? turn - 1 : turn
  return openingHand + Math.max(0, extraDraws)
}
