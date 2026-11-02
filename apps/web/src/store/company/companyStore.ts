import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { companyApi } from './companyApi';
import { purgeStoreAction } from '../resetStore';

export const companyCombinedReducer = combineReducers({
  [companyApi.reducerPath]: companyApi.reducer,
});

export const companyRootReducer: typeof companyCombinedReducer = (state, action) => {
  if (purgeStoreAction.match(action)) {
    return companyCombinedReducer(undefined, action);
  }
  return companyCombinedReducer(state, action);
};

export type CompanyRootState = ReturnType<typeof companyCombinedReducer>;

/**
 * Creates a new, isolated Redux Toolkit store instance for Company Admin.
 * Factory pattern ensures zero state leakage across server-rendered requests or test runs.
 */
export function makeCompanyStore() {
  return configureStore({
    reducer: companyRootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: true,
      }).concat(companyApi.middleware),
  });
}

export type CompanyStore = ReturnType<typeof makeCompanyStore>;
export type CompanyDispatch = CompanyStore['dispatch'];
