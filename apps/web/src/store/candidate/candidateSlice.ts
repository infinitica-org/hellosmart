import { createSlice, type Slice, type PayloadAction } from '@reduxjs/toolkit';

export interface CandidateState {
  activeAssignmentId: string | null;
  activeSessionId: string | null;
  consentAccepted: boolean;
  isSubmitting: boolean;
  submissionReceiptId: string | null;
}

const initialState: CandidateState = {
  activeAssignmentId: null,
  activeSessionId: null,
  consentAccepted: false,
  isSubmitting: false,
  submissionReceiptId: null,
};

export const candidateSlice: Slice<CandidateState> = createSlice({
  name: 'candidate',
  initialState,
  reducers: {
    setActiveAssignmentId(state, action: PayloadAction<string | null>) {
      state.activeAssignmentId = action.payload;
    },
    setActiveSessionId(state, action: PayloadAction<string | null>) {
      state.activeSessionId = action.payload;
    },
    setConsentAccepted(state, action: PayloadAction<boolean>) {
      state.consentAccepted = action.payload;
    },
    setSubmitting(state, action: PayloadAction<boolean>) {
      state.isSubmitting = action.payload;
    },
    setSubmissionReceiptId(state, action: PayloadAction<string | null>) {
      state.submissionReceiptId = action.payload;
    },
    resetCandidateState() {
      return initialState;
    },
  },
});

export const {
  setActiveAssignmentId,
  setActiveSessionId,
  setConsentAccepted,
  setSubmitting,
  setSubmissionReceiptId,
  resetCandidateState,
} = candidateSlice.actions;

export default candidateSlice.reducer;
