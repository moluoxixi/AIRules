#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const SCHEMA_VERSION = 1
const POLICY_VERSION = 'airules-development/v1'
const CHANGE_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/u
const STATES = new Set([
  'intake',
  'spec-ready',
  'plan-ready',
  'test-ready',
  'implementing',
  'verifying',
  'review-ready',
  'release-ready',
  'learning',
  'done',
  'blocked',
])

const GATES = {
  'requirement': { from: 'intake', to: 'spec-ready' },
  'architecture': { from: 'spec-ready', to: 'plan-ready' },
  'scenario-test': { from: 'plan-ready', to: 'test-ready' },
  'execution': { from: 'test-ready', to: 'implementing' },
  'implementation': { from: 'implementing', to: 'verifying' },
  'automated': { from: 'verifying', to: 'review-ready' },
  'review': { from: 'review-ready', to: 'release-ready' },
  'release': { from: 'release-ready', to: 'learning' },
  'learning': { from: 'learning', to: 'done' },
}

const FAILURE_ROUTES = {
  REQUIREMENT_GAP: 'intake',
  DESIGN_CONTRACT_ERROR: 'spec-ready',
  TEST_CONTRACT_MISSING: 'plan-ready',
  IMPLEMENTATION_DEFECT: 'implementing',
  TEST_ORACLE_ERROR: 'plan-ready',
  ENVIRONMENT_FAILURE: 'blocked',
  FLAKY_TEST: 'blocked',
  SECURITY_POLICY: 'blocked',
}

function parseArgs(argv) {
  const positionals = []
  const options = {}
  const booleanOptions = new Set(['help', 'json', 'repair'])

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument.startsWith('--')) {
      positionals.push(argument)
      continue
    }

    const name = argument.slice(2)
    if (booleanOptions.has(name)) {
      options[name] = true
      continue
    }

    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for --${name}`)
    }
    options[name] = value
    index += 1
  }

  return { options, positionals }
}

function printHelp() {
  process.stdout.write(`Usage:
  workflow.mjs init <change> [--title <title>] [--json]
  workflow.mjs status <change> [--json]
  workflow.mjs next <change> [--json]
  workflow.mjs gate <change> <gate> --status <pass|fail> --evidence <ref> --idempotency-key <key> [--failure-class <class>] [--route-to <state>] [--json]
  workflow.mjs replay <change> [--repair] [--json]
`)
}

function requireChange(value) {
  if (typeof value !== 'string' || !CHANGE_PATTERN.test(value)) {
    throw new Error('Change name must be lower-case kebab-case and at most 63 characters')
  }
  return value
}

function requireStringOption(options, name, maxLength = 2048) {
  const value = options[name]
  if (typeof value !== 'string' || value.trim() === '' || value.length > maxLength) {
    throw new Error(`--${name} is required and must be at most ${maxLength} characters`)
  }
  return value
}

function projectRoot(options) {
  return path.resolve(typeof options['project-root'] === 'string' ? options['project-root'] : process.cwd())
}

function changePaths(root, change) {
  const changeRoot = path.join(root, 'openspec', 'changes', change)
  return {
    root,
    change,
    changeRoot,
    snapshot: path.join(changeRoot, 'change.json'),
    ledger: path.join(changeRoot, 'evidence', 'events.jsonl'),
    gates: path.join(changeRoot, 'evidence', 'gates'),
    lock: path.join(changeRoot, '.workflow.lock'),
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  }
  catch (error) {
    throw new Error(`Cannot read valid JSON from ${file}: ${String(error)}`)
  }
}

function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.tmp-${process.pid}-${randomUUID()}`
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
    fs.renameSync(temporary, file)
  }
  finally {
    fs.rmSync(temporary, { force: true })
  }
}

function readEvents(paths) {
  if (!fs.existsSync(paths.ledger)) {
    return []
  }

  const contents = fs.readFileSync(paths.ledger, 'utf8').trim()
  if (contents === '') {
    return []
  }

  return contents.split(/\r?\n/u).map((line, index) => {
    try {
      return JSON.parse(line)
    }
    catch (error) {
      throw new Error(`Invalid workflow event at line ${index + 1}: ${String(error)}`)
    }
  })
}

function appendEvent(paths, event) {
  const events = readEvents(paths)
  const nextEvent = {
    schema_version: SCHEMA_VERSION,
    sequence: events.length + 1,
    event_id: randomUUID(),
    occurred_at: new Date().toISOString(),
    policy_version: POLICY_VERSION,
    change_unit_id: `CU-${paths.change}`,
    ...event,
  }
  fs.mkdirSync(path.dirname(paths.ledger), { recursive: true })
  fs.appendFileSync(paths.ledger, `${JSON.stringify(nextEvent)}\n`, 'utf8')
  return nextEvent
}

function withLock(paths, action) {
  fs.mkdirSync(paths.changeRoot, { recursive: true })
  let descriptor
  try {
    descriptor = fs.openSync(paths.lock, 'wx')
    fs.writeFileSync(descriptor, `${process.pid}\n`, 'utf8')
  }
  catch (error) {
    if (error && error.code === 'EEXIST') {
      throw new Error(`Change is locked by another workflow process: ${paths.change}`)
    }
    throw error
  }

  try {
    return action()
  }
  finally {
    if (descriptor !== undefined) {
      fs.closeSync(descriptor)
    }
    fs.rmSync(paths.lock, { force: true })
  }
}

function loadSnapshot(paths) {
  if (!fs.existsSync(paths.snapshot)) {
    throw new Error(`Unknown change: ${paths.change}`)
  }
  const snapshot = readJson(paths.snapshot)
  if (snapshot.change !== paths.change || snapshot.change_unit_id !== `CU-${paths.change}` || !STATES.has(snapshot.state)) {
    throw new Error(`Invalid change snapshot: ${paths.snapshot}`)
  }
  return snapshot
}

function nextGate(state) {
  return Object.entries(GATES).find(([, transition]) => transition.from === state)?.[0] ?? null
}

function initialize(paths, options) {
  if (fs.existsSync(paths.snapshot)) {
    throw new Error(`Change already exists: ${paths.change}`)
  }

  fs.mkdirSync(path.join(paths.changeRoot, 'specs'), { recursive: true })
  fs.mkdirSync(paths.gates, { recursive: true })

  return withLock(paths, () => {
    const openspecMetadata = path.join(paths.changeRoot, '.openspec.yaml')
    if (fs.existsSync(openspecMetadata)) {
      const metadata = fs.readFileSync(openspecMetadata, 'utf8')
      if (!/^schema:\s*airules-development\s*$/mu.test(metadata)) {
        throw new Error(`Existing OpenSpec change does not use airules-development schema: ${paths.change}`)
      }
    }
    else {
      fs.writeFileSync(
        openspecMetadata,
        `schema: airules-development\ncreated: ${new Date().toISOString().slice(0, 10)}\n`,
        'utf8',
      )
    }

    const timestamp = new Date().toISOString()
    const event = appendEvent(paths, {
      event_type: 'change_initialized',
      from_state: null,
      to_state: 'intake',
      title: typeof options.title === 'string' ? options.title : paths.change,
    })
    const snapshot = {
      schema_version: SCHEMA_VERSION,
      policy_version: POLICY_VERSION,
      change: paths.change,
      change_unit_id: `CU-${paths.change}`,
      title: event.title,
      state: 'intake',
      revision: event.sequence,
      created_at: timestamp,
      updated_at: timestamp,
      last_event_sequence: event.sequence,
      failure_counts: {},
    }
    atomicWriteJson(paths.snapshot, snapshot)
    return snapshot
  })
}

function recordGate(paths, gateName, options) {
  const transition = GATES[gateName]
  if (!transition) {
    throw new Error(`Unknown gate: ${gateName}`)
  }

  const status = requireStringOption(options, 'status', 16)
  if (status !== 'pass' && status !== 'fail') {
    throw new Error('--status must be pass or fail')
  }
  const evidence = requireStringOption(options, 'evidence')
  const idempotencyKey = requireStringOption(options, 'idempotency-key', 256)

  return withLock(paths, () => {
    const snapshot = loadSnapshot(paths)
    const events = readEvents(paths)
    const duplicate = events.find(event => event.idempotency_key === idempotencyKey)
    if (duplicate) {
      return {
        change_unit_id: snapshot.change_unit_id,
        state: snapshot.state,
        duplicate: true,
        event_sequence: duplicate.sequence,
      }
    }

    if (snapshot.state !== transition.from) {
      throw new Error(`Gate ${gateName} requires state ${transition.from}; current state is ${snapshot.state}`)
    }

    const failureCounts = { ...(snapshot.failure_counts ?? {}) }
    let toState = transition.to
    let failureClass
    let failureSignature
    let failureCount = 0
    let blocked = false

    if (status === 'fail') {
      failureClass = requireStringOption(options, 'failure-class', 128)
      const defaultRoute = FAILURE_ROUTES[failureClass]
      if (!defaultRoute) {
        throw new Error(`Unknown failure class: ${failureClass}`)
      }
      failureSignature = `${gateName}:${failureClass}`
      failureCount = Number(failureCounts[failureSignature] ?? 0) + 1
      failureCounts[failureSignature] = failureCount
      toState = typeof options['route-to'] === 'string' ? options['route-to'] : defaultRoute
      if (!STATES.has(toState)) {
        throw new Error(`Invalid failure route state: ${toState}`)
      }
      blocked = failureCount >= 2 || toState === 'blocked'
      if (blocked) {
        toState = 'blocked'
      }
    }

    const event = appendEvent(paths, {
      event_type: status === 'pass' ? 'gate_passed' : 'gate_failed',
      gate: gateName,
      status,
      from_state: snapshot.state,
      to_state: toState,
      evidence_refs: [evidence],
      idempotency_key: idempotencyKey,
      failure_class: failureClass,
      failure_signature: failureSignature,
      failure_count: failureCount || undefined,
      blocked,
    })

    const gateResult = {
      schema_version: SCHEMA_VERSION,
      policy_version: POLICY_VERSION,
      change_unit_id: snapshot.change_unit_id,
      gate: gateName,
      status,
      failure_class: failureClass ?? null,
      route_to: toState,
      evidence_refs: [evidence],
      retryable: status === 'fail' && !blocked,
      idempotency_key: idempotencyKey,
      event_sequence: event.sequence,
    }
    atomicWriteJson(path.join(paths.gates, `${String(event.sequence).padStart(4, '0')}-${gateName}.json`), gateResult)

    const updated = {
      ...snapshot,
      state: toState,
      revision: event.sequence,
      updated_at: event.occurred_at,
      last_event_sequence: event.sequence,
      failure_counts: failureCounts,
    }
    atomicWriteJson(paths.snapshot, updated)

    return {
      change_unit_id: updated.change_unit_id,
      state: updated.state,
      gate: gateName,
      status,
      duplicate: false,
      blocked,
      failure_count: failureCount,
      event_sequence: event.sequence,
    }
  })
}

function replayEvents(events) {
  if (events.length === 0 || events[0].event_type !== 'change_initialized') {
    throw new Error('Workflow ledger must begin with change_initialized')
  }

  let state = events[0].to_state
  const failureCounts = {}
  for (const event of events.slice(1)) {
    if (event.from_state !== state) {
      throw new Error(`Workflow event ${event.sequence} expects ${event.from_state}, replay is at ${state}`)
    }
    state = event.to_state
    if (event.event_type === 'gate_failed' && event.failure_signature) {
      failureCounts[event.failure_signature] = Number(failureCounts[event.failure_signature] ?? 0) + 1
    }
  }

  return {
    state,
    failureCounts,
    lastSequence: events.at(-1).sequence,
  }
}

function replay(paths, repair) {
  const snapshot = loadSnapshot(paths)
  const replayed = replayEvents(readEvents(paths))
  const consistent = snapshot.state === replayed.state
    && snapshot.last_event_sequence === replayed.lastSequence
    && JSON.stringify(snapshot.failure_counts ?? {}) === JSON.stringify(replayed.failureCounts)

  const result = {
    change_unit_id: snapshot.change_unit_id,
    snapshot_state: snapshot.state,
    replayed_state: replayed.state,
    consistent,
    repaired: false,
    last_event_sequence: replayed.lastSequence,
  }

  if (!consistent && repair) {
    withLock(paths, () => {
      atomicWriteJson(paths.snapshot, {
        ...snapshot,
        state: replayed.state,
        revision: replayed.lastSequence,
        updated_at: new Date().toISOString(),
        last_event_sequence: replayed.lastSequence,
        failure_counts: replayed.failureCounts,
      })
    })
    result.repaired = true
  }

  return result
}

function printResult(result, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(result)}\n`)
    return
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

function main() {
  const { options, positionals } = parseArgs(process.argv.slice(2))
  if (options.help === true || positionals.length === 0) {
    printHelp()
    return
  }

  const command = positionals[0]
  const change = requireChange(positionals[1])
  const paths = changePaths(projectRoot(options), change)
  let result
  let exitCode = 0

  if (command === 'init') {
    result = initialize(paths, options)
  }
  else if (command === 'status') {
    const snapshot = loadSnapshot(paths)
    result = { ...snapshot, next_gate: nextGate(snapshot.state) }
  }
  else if (command === 'next') {
    const snapshot = loadSnapshot(paths)
    result = {
      change_unit_id: snapshot.change_unit_id,
      state: snapshot.state,
      required_gate: nextGate(snapshot.state),
    }
  }
  else if (command === 'gate') {
    result = recordGate(paths, positionals[2], options)
  }
  else if (command === 'replay') {
    result = replay(paths, options.repair === true)
    if (!result.consistent && !result.repaired) {
      exitCode = 2
    }
  }
  else {
    throw new Error(`Unknown command: ${command}`)
  }

  printResult(result, options.json === true)
  process.exitCode = exitCode
}

try {
  main()
}
catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  if (process.argv.includes('--json')) {
    process.stderr.write(`${JSON.stringify({ error: message })}\n`)
  }
  else {
    process.stderr.write(`Error: ${message}\n`)
  }
  process.exitCode = 1
}
