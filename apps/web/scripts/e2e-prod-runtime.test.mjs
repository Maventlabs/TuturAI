import test from 'node:test'
import assert from 'node:assert/strict'
import { retryableProviderStatus, withProviderRetry } from './e2e-prod-runtime.mjs'

function playwrightLike(status) {
  return { response: { status: () => status } }
}

/** Records requested delays instead of waiting, so backoff is asserted, not slept. */
function fakeClock() {
  const delays = []
  return { delays, sleep: async (ms) => { delays.push(ms) } }
}

test('only product-declared retryable provider statuses are replayed', () => {
  for (const status of [429, 502, 503, 504]) assert.equal(retryableProviderStatus(status), true)
  for (const status of [200, 201, 400, 401, 403, 404, 409, 422, 500]) {
    assert.equal(retryableProviderStatus(status), false, `${status} must not be replayed`)
  }
})

test('a first-attempt success is returned without replaying or waiting', async () => {
  const clock = fakeClock()
  let calls = 0
  const outcome = await withProviderRetry(async () => {
    calls += 1
    return playwrightLike(200)
  }, { sleep: clock.sleep })

  assert.equal(calls, 1)
  assert.equal(outcome.status, 200)
  assert.equal(outcome.replays, 0)
  assert.deepEqual(clock.delays, [])
})

test('a retryable provider outage is replayed until the provider recovers', async () => {
  const clock = fakeClock()
  const statuses = [503, 503, 200]
  let calls = 0
  const outcome = await withProviderRetry(async () => {
    const status = statuses[calls]
    calls += 1
    return playwrightLike(status)
  }, { sleep: clock.sleep })

  assert.equal(calls, 3)
  assert.equal(outcome.status, 200)
  assert.equal(outcome.replays, 2)
  assert.deepEqual(clock.delays, [5_000, 8_000])
})

test('a non-retryable failure surfaces immediately so a real defect is never retried away', async () => {
  const clock = fakeClock()
  let calls = 0
  const outcome = await withProviderRetry(async () => {
    calls += 1
    return playwrightLike(400)
  }, { sleep: clock.sleep })

  assert.equal(calls, 1)
  assert.equal(outcome.status, 400)
  assert.equal(outcome.replays, 0)
  assert.deepEqual(clock.delays, [])
})

test('a permanently retryable outage gives up after the configured attempts and reports them', async () => {
  const clock = fakeClock()
  let calls = 0
  const outcome = await withProviderRetry(async () => {
    calls += 1
    return playwrightLike(503)
  }, { attempts: 4, sleep: clock.sleep })

  assert.equal(calls, 4)
  assert.equal(outcome.status, 503, 'the last provider status must reach the caller so the suite can still assert on it')
  assert.equal(outcome.replays, 3)
})

test('backoff grows and is capped so a long outage cannot stall the suite forever', async () => {
  const clock = fakeClock()
  await withProviderRetry(async () => playwrightLike(503), {
    attempts: 7,
    baseDelayMs: 1_000,
    maxDelayMs: 8_000,
    sleep: clock.sleep,
  })

  assert.deepEqual(clock.delays, [1_000, 1_600, 2_560, 4_096, 6_554, 8_000])
  assert.ok(clock.delays.every((ms) => ms <= 8_000))
})

test('plain status numbers are accepted as well as Playwright response objects', async () => {
  const clock = fakeClock()
  const statuses = [503, 200]
  let calls = 0
  const outcome = await withProviderRetry(async () => statuses[calls++], { sleep: clock.sleep })

  assert.equal(outcome.status, 200)
  assert.equal(outcome.replays, 1)
})