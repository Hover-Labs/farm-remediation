import axios from 'axios'
import { BigMapEntry, FarmStorage, RemediationData } from './types'
import BigNumber from 'bignumber.js'

const REMEDIATION_BLOCK = "2568672"

const getMapKeys = async (mapId: string): Promise<Array<BigMapEntry>> => {
  const url = `https://api.tzkt.io/v1/bigmaps/${mapId}/historical_keys/${REMEDIATION_BLOCK}?limit=1000`
  const result = await axios.get(url)

  // Note that this will only return us a set of the first 1000 keys. Do a check to make sure we don't need to paginate.
  const data = result.data as Array<BigMapEntry>
  if (data.length === 1000) {
    throw new Error('You need to paginate!')
  }
  return data
}

const getFarmData = async (contractAddress: string): Promise<FarmStorage> => {
  const url = `https://api.tzkt.io/v1/contracts/${contractAddress}/storage?level=${REMEDIATION_BLOCK}`
  const result = await axios.get(url)
  return result.data
}

const calculateAmountOwed = (farmData: FarmStorage, mapEntry: BigMapEntry): BigNumber => {
  // if there are no LP tokens, then rewards are zero.
  if (mapEntry.value.lpTokenBalance === "0") {
    return new BigNumber(0)
  }
  const mantissa = new BigNumber("1000000000000000000000000000000000000")

  const elapsedBlocks = new BigNumber(REMEDIATION_BLOCK).minus(farmData.farm.lastBlockUpdate)
  const rewardForElapsedBlocks = elapsedBlocks.times(farmData.farm.plannedRewards.rewardPerBlock)

  const accum = new BigNumber(farmData.farm.accumulatedRewardPerShare).plus(rewardForElapsedBlocks.times(mantissa).dividedToIntegerBy(farmData.farmLpTokenBalance))

  const owed = (accum.minus(mapEntry.value.accumulatedRewardPerShareStart)).times(mapEntry.value.lpTokenBalance).dividedBy(mantissa)
  return owed
}

const formatAmount = (input: BigNumber): string => {
  return input.dividedBy(new BigNumber(10).pow(18)).toFixed(18, BigNumber.ROUND_DOWN)
}

const main = async (contractAddress: string, mapId: string) => {
  console.log("Calculating Remediation...")
  console.log(`Contract: ${contractAddress}`)
  console.log(`Big Map ID: ${mapId}`)
  console.log(`Remediation Block: ${REMEDIATION_BLOCK}`)
  console.log()

  // Fetch data
  const mapEntries = await getMapKeys(mapId)
  console.log(`Fetched map keys!`)
  console.log()

  const farmData = await getFarmData(contractAddress)
  console.log(`Fetched contract data!`)
  console.log()

  // Calculate Remediation Amounts for each entry
  const remediations: Array<RemediationData> = mapEntries.map((mapEntry: BigMapEntry) => {
    return {
      address: mapEntry.key,
      amount: calculateAmountOwed(farmData, mapEntry)
    }
  })

  // Filter Zero Entries
  const nonZeroRemediations = remediations.filter((remediation: RemediationData) => {
    return !remediation.amount.eq(0)
  })

  // Sum the amount for sanity
  const totalAmountOwed = nonZeroRemediations.reduce((accumulated: BigNumber, next: RemediationData) => {
    return accumulated.plus(next.amount)
  }, new BigNumber(0))

  // Print
  console.log(`Amounts Owed:`)
  console.log(`===================================`)
  for (let i = 0; i < nonZeroRemediations.length; i++) {
    const remediation = nonZeroRemediations[i]
    console.log(`${remediation.address}: ${formatAmount(remediation.amount)} KDAO`)
  }
  console.log(`===================================`)
  console.log()
  console.log(`Number Addresses: ${nonZeroRemediations.length}`)
  console.log(`Total Owed: ${formatAmount(totalAmountOwed)}`)
  console.log()
}

// kUSD
// main("KT1HDXjPtjv7Y7XtJxrNc5rNjnegTi2ZzNfv", "7262")

// QLkUSD
main("KT18oxtA5uyhyYXyAVhTa7agJmxHCTjHpiF7", "7263")

// Youves LP
// main("KT1VTA694ZHFQPtxg76HzY7gHdvi7idYEYje", "105534")