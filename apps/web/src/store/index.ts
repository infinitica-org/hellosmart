import { configureStore } from '@reduxjs/toolkit';
import { candidateApi } from './candidate/candidateApi';
import candidateReducer from './candidate/candidateSlice';

export const store = configureStore({
  reducer: {
    candidate: candidateReducer,
    [candidateApi.reducerPath]: candidateApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(candidateApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

