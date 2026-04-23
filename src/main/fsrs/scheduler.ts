import { FSRS, generatorParameters, Rating as FsrsRating, type Card as FsrsCard, State as FsrsStateEnum, type Grade } from 'ts-fsrs'
import type { ReviewState } from '../../shared/schema'
import type { Rating } from '../../shared/constants'

export type FsrsOptions = { desiredRetention?: number; maximumInterval?: number }

export function createScheduler(opts: FsrsOptions = {}): FSRS {
  const params = generatorParameters({
    request_retention: opts.desiredRetention ?? 0.9,
    maximum_interval: opts.maximumInterval ?? 365
  })
  return new FSRS(params)
}

const stateMap: Record<ReviewState['state'], FsrsStateEnum> = {
  New: FsrsStateEnum.New,
  Learning: FsrsStateEnum.Learning,
  Review: FsrsStateEnum.Review,
  Relearning: FsrsStateEnum.Relearning
}
const reverseStateMap: Record<FsrsStateEnum, ReviewState['state']> = {
  [FsrsStateEnum.New]: 'New',
  [FsrsStateEnum.Learning]: 'Learning',
  [FsrsStateEnum.Review]: 'Review',
  [FsrsStateEnum.Relearning]: 'Relearning'
}
const ratingMap: Record<Rating, Grade> = {
  Again: FsrsRating.Again as Grade,
  Hard: FsrsRating.Hard as Grade,
  Good: FsrsRating.Good as Grade,
  Easy: FsrsRating.Easy as Grade
}

function toFsrsCard(s: ReviewState): FsrsCard {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    reps: s.reps,
    lapses: s.lapses,
    state: stateMap[s.state],
    last_review: s.last_review ? new Date(s.last_review) : undefined
  }
}

export function rateCard(
  scheduler: FSRS,
  state: ReviewState,
  rating: Rating,
  now: Date = new Date()
): ReviewState {
  const card = toFsrsCard(state)
  const result = scheduler.next(card, now, ratingMap[rating])
  const next = result.card
  return {
    id: state.id,
    due: next.due.toISOString(),
    stability: next.stability,
    difficulty: next.difficulty,
    elapsed_days: next.elapsed_days,
    scheduled_days: next.scheduled_days,
    reps: next.reps,
    lapses: next.lapses,
    state: reverseStateMap[next.state],
    last_review: now.toISOString(),
    history: [
      ...state.history,
      { ts: now.toISOString(), rating, elapsed_days: state.elapsed_days }
    ]
  }
}
