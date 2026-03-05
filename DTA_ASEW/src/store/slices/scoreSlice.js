import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../../config";

const API_URL = `${API_BASE_URL}/api/score`;

/* =====================================
   ✅ FETCH SCORE TABLE DATA
   GET: /api/score
===================================== */
export const fetchScoreData = createAsyncThunk(
  "score/fetchScoreData",
  async (_, { getState, rejectWithValue }) => {
    const { token } = getState().auth;

    try {
      const res = await axios.get(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("✅ Score API Response:", res.data);

      // ✅ Return only array part
      return res.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch Score Data"
      );
    }
  }
);

/* =====================================
   ✅ FETCH SCORE SUMMARY
   GET: /api/score/summary
===================================== */
export const fetchScoreSummary = createAsyncThunk(
  "score/fetchScoreSummary",
  async (_, { getState, rejectWithValue }) => {
    const { token } = getState().auth;

    try {
      const res = await axios.get(`${API_URL}/summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return res.data;
    } catch (error) {
      return rejectWithValue("Failed to fetch summary");
    }
  }
);

/* =====================================
   ✅ SCORE SLICE
===================================== */
const scoreSlice = createSlice({
  name: "score",

  initialState: {
    scoreList: [],

    summary: null,

    isLoading: false,
    isSummaryLoading: false,

    error: null,
  },

  reducers: {},

  extraReducers: (builder) => {
    builder

      /* ===============================
         ✅ FETCH SCORE TABLE
      =============================== */
      .addCase(fetchScoreData.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })

      .addCase(fetchScoreData.fulfilled, (state, action) => {
        state.isLoading = false;

        // ✅ Always Ensure Array
        state.scoreList = Array.isArray(action.payload)
          ? action.payload
          : [];
      })

      .addCase(fetchScoreData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      /* ===============================
         ✅ FETCH SUMMARY
      =============================== */
      .addCase(fetchScoreSummary.pending, (state) => {
        state.isSummaryLoading = true;
        state.error = null;
      })

      .addCase(fetchScoreSummary.fulfilled, (state, action) => {
        state.isSummaryLoading = false;
        state.summary = action.payload;
      })

      .addCase(fetchScoreSummary.rejected, (state, action) => {
        state.isSummaryLoading = false;
        state.error = action.payload;
      });
  },
});

export default scoreSlice.reducer;
