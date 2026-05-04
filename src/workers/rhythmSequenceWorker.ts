/// <reference lib="webworker" />

import type { RhythmItem } from '@/utils/rhythm'
import { generateRhythmDrivenSequence, type GeneratedSequence } from '@/utils/rhythmSequence'

type StartPayload = {
  item: RhythmItem
  min: number
  max: number
  maxAmplitude: number
  repeatCount: number
}

type InMsg = { type: 'start'; payload: StartPayload } | { type: 'stop' }

type OutMsg =
  | { type: 'progress'; progress: number; stage: string }
  | { type: 'result'; result: GeneratedSequence }
  | { type: 'done' }
  | { type: 'error'; message: string }

let stopping = false

self.onmessage = (event: MessageEvent<InMsg>) => {
  const message = event.data
  if (message.type === 'stop') {
    stopping = true
    return
  }
  if (message.type === 'start') {
    stopping = false
    run(message.payload).catch((error: unknown) => {
      const post = self as unknown as Worker
      post.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Sequence generation failed.',
      } satisfies OutMsg)
      post.postMessage({ type: 'done' } satisfies OutMsg)
    })
  }
}

async function run(payload: StartPayload) {
  const post = self as unknown as Worker
  post.postMessage({ type: 'progress', progress: 10, stage: 'Parsing rhythm composition' } satisfies OutMsg)
  await tick()
  if (stopping) return

  post.postMessage({ type: 'progress', progress: 35, stage: 'Optimizing rhythmic phrases' } satisfies OutMsg)
  await tick()
  if (stopping) return

  post.postMessage({ type: 'progress', progress: 70, stage: 'Synthesizing integer layers' } satisfies OutMsg)
  await tick()
  if (stopping) return

  const result = generateRhythmDrivenSequence(payload)
  if (stopping) return

  post.postMessage({ type: 'progress', progress: 100, stage: 'Completed' } satisfies OutMsg)
  post.postMessage({ type: 'result', result } satisfies OutMsg)
  post.postMessage({ type: 'done' } satisfies OutMsg)
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}