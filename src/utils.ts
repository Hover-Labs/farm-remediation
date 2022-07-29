import BigNumber from "bignumber.js"

export const FILENAME = './remediations.csv'

// Format a bignumber without a mantissa into a human readable number with 18 decimals
export const formatAmount = (input: BigNumber): string => {
  return input.dividedBy(new BigNumber(10).pow(18)).toFixed(18, BigNumber.ROUND_DOWN)
}