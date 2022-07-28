import BigNumber from "bignumber.js"

export type BigMapEntry = {
  id: number,
  active: boolean,
  hash: string,
  key: string,
  value: {
    lpTokenBalance: string,
    accumulatedRewardPerShareStart: string
  }
}

export type FarmStorage = {
  farm: {
    claimedRewards: {
      paid: string,
      unpaid: string
    },
    plannedRewards: {
      totalBlocks: string,
      rewardPerBlock: string
    },
    lastBlockUpdate: string,
    accumulatedRewardPerShare: string
  },
  addresses: {
    admin: string,
    rewardReserve: string,
    lpTokenContract: string,
    rewardTokenContract: string
  },
  delegators: number,
  farmLpTokenBalance: string
}

export type RemediationData = {
  address: string
  amount: BigNumber
}