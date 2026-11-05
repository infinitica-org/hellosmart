import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { adminApi } from './adminApi';
import { purgeStoreAction } from '../resetStore';

export const adminCombinedReducer = combineReducers({
  [adminApi.reducerPath]: adminApi.reducer,
});

export const adminRootReducer: typeof adminCombinedReducer = (state, action) => {
  if (purgeStoreAction.match(action)) {
    return adminCombinedReducer(undefined, action);
  }
  return adminCombinedReducer(state, action);
};

export type AdminRootState = ReturnType<typeof adminCombinedReducer>;

/**
 * Creates a new, isolated Redux Toolkit store instance for Platform Super Admin.
 * Factory pattern ensures zero state leakage across server-rendered requests or test runs.
 */
export function makeAdminStore() {
  return configureStore({
    reducer: adminRootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: true,
      }).concat(adminApi.middleware),
  });
}

export type AdminStore = ReturnType<typeof makeAdminStore>;
export type AdminDispatch = AdminStore['dispatch'];
