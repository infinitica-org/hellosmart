import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { candidateApi } from './candidateApi';
import { purgeStoreAction } from '../resetStore';

export const candidateCombinedReducer = combineReducers({
  [candidateApi.reducerPath]: candidateApi.reducer,
});

export const candidateRootReducer: typeof candidateCombinedReducer = (state, action) => {
  if (purgeStoreAction.match(action)) {
    return candidateCombinedReducer(undefined, action);
  }
  return candidateCombinedReducer(state, action);
};

export type CandidateRootState = ReturnType<typeof candidateCombinedReducer>;

/**
 * Creates a new, isolated Redux Toolkit store instance for Candidate portal.
 * Factory pattern ensures zero state leakage across server-rendered requests or test runs.
 */
export function makeCandidateStore() {
  return configureStore({
    reducer: candidateRootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: true,
      }).concat(candidateApi.middleware),
  });
}

export type CandidateStore = ReturnType<typeof makeCandidateStore>;
export type CandidateDispatch = CandidateStore['dispatch'];
