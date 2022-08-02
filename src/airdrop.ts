import { TezosToolkit } from '@taquito/taquito'
import { InMemorySigner } from '@taquito/signer'
import * as fs from 'fs'
import { RemediationData, CompletedAirDrop } from './types'
import BigNumber from 'bignumber.js'
import { FILENAME, formatAmount } from './utils'

const KDAO_CONTRACT = 'KT1JkoE42rrMBP9b2oDhbx6EUr26GcySZMUH'
const NODE_URL = 'https://mainnet.api.tez.ie'

const BATCH_SIZE = 167
const NUM_CONFIRMATIONS_REQUIRED = 1

const parseCSV = (): Array<RemediationData> => {
  // Read our CSV and split into lines
  const fileData = fs.readFileSync(FILENAME, 'utf-8')
  const lines = fileData.split('\n')

  // Last line is a blank newline
  lines.pop()

  // Map each line into a remediation data object
  return lines.map((line: string) => {
    const components = line.split(',')
    return {
      amount: new BigNumber(components[1].trim()),
      address: components[0].trim()
    }
  })
}

const sleep = async (seconds: number): Promise<void> => {
  const milliseconds = seconds * 1000
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}


const main = async () => {
  // Load a private key
  const privateKey = process.env['KDAO_PK']
  if (privateKey === undefined) {
    throw new Error('Please set the KDAO_PK env variable')
  }
  const signer = new InMemorySigner(privateKey);

  // Load our public key
  const fromAddress = await signer.publicKeyHash()
  console.log(`Sending from address ${fromAddress}`)
  console.log()

  // Set up a tezos toolkit
  const tezos = new TezosToolkit(NODE_URL)
  tezos.setProvider({ signer })

  // Load the KDAO Contract
  const kdao = await tezos.contract.at(KDAO_CONTRACT)

  // Parse our CSV
  const remediationDatas = parseCSV()
  const totalAmount = remediationDatas.reduce((accumulated: BigNumber, next: RemediationData) => {
    return accumulated.plus(next.amount)
  }, new BigNumber(0))
  console.log(`Found ${remediationDatas.length} remediations`)
  console.log(`Total Amount: ${formatAmount(totalAmount)} KDAO`)
  console.log(``)

  console.log(`Sleeping for 30s before starting the Airdrop process...`)
  console.log(`!!! If the numbers above do not look correct, CTRL+C this process now!!!`)
  await sleep(30)
  console.log()

  // Separate transactions into batches
  const numBatches = Math.ceil(remediationDatas.length / BATCH_SIZE)
  const batches: Array<Array<RemediationData>> = []
  for (let i = 0; i < remediationDatas.length; i++) {
    const drop = remediationDatas[i]
    const batchIndex = i % numBatches

    // Initialize a batch if not initialized
    if (batches.length <= batchIndex) {
      batches[batchIndex] = []
    }

    batches[batchIndex].push(drop)
  }

  // Nicely run each batch
  const completedOps: Array<CompletedAirDrop> = []
  for (let i = 0; i < batches.length; i++) {
    try {
      console.log(`>> Processing batch ${i + 1} of ${batches.length}`)

      const batch = batches[i]
      const tx = tezos.contract.batch()
      for (let j = 0; j < batch.length; j++) {
        const drop = batch[j]

        tx.withTransfer({
          ...kdao.methods.transfer(
            await signer.publicKeyHash(),
            drop.address,
            drop.amount,
          ).toTransferParams({ gasLimit: 8000 })
        })
      }

      // Send and await confirmations
      const txResult = await tx.send()
      console.log(
        `>> Send in hash ${txResult.hash}. Waiting for ${NUM_CONFIRMATIONS_REQUIRED} confirmation(s).`,
      )
      await txResult.confirmation(NUM_CONFIRMATIONS_REQUIRED)
      console.log('>> Confirmed!')
      console.log('')

      // Record results of airdrop
      for (let j = 0; j < batch.length; j++) {
        const drop = batch[j]
        completedOps.push({
          address: drop.address,
          amount: drop.amount.toFixed(0),
          operationHash: txResult.hash,
        })
      }
    } catch (e) {
      console.log(``)
      console.log(`-----------------------------------------------`)
      console.log(`Unexpected error: ${JSON.stringify(e)}`)
      console.log(`Error occured in batch ${i}`)
      console.log(`Batch ${i} dump:`)
      console.log(JSON.stringify(batches[i]))
      console.log(`Please verify that the batch succeeded.`)
      console.log(`-----------------------------------------------`)
      console.log(``)
    }
  }
  console.log("Airdropping complete")
  console.log()

  // Write to file
  const dropFile = './completed'
  fs.writeFileSync(dropFile, `address, amount, operation hash,\n`)
  for (let i = 0; i < completedOps.length; i++) {
    const completedOp = completedOps[i]

    fs.appendFileSync(
      dropFile,
      `${completedOp.address}, ${completedOp.amount}, ${completedOp.operationHash},\n`,
    )
  }
  console.log(`> Written to ${dropFile}`)
  console.log('')

  console.log(`All Done!`)
  console.log()
}
main()

