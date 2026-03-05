import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../../config";

const API_URL = `${API_BASE_URL}/api/expenses`;

export const fetchExpenses = createAsyncThunk(
  "expense/fetchExpenses",
  async (_, { getState, rejectWithValue }) => {
    const { token } = getState().auth;

    try {
      const res = await axios.get(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch expenses",
      );
    }
  },
);

export const createExpense = createAsyncThunk(
  "expense/createExpense",
  async (expenseData, { getState, rejectWithValue }) => {
    const { token } = getState().auth;

    try {
      const res = await axios.post(API_URL, expenseData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      return res.data.expense;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to submit expense",
      );
    }
  },
);

export const editExpense = createAsyncThunk(
  "expense/editExpense",
  async ({ id, updatedData }, { getState, rejectWithValue }) => {
    const { token } = getState().auth;

    try {
      const res = await axios.put(`${API_URL}/edit/${id}`, updatedData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      return res.data.expense; // ✅ Return updated expense object
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to edit expense",
      );
    }
  },
);

// ✅ SLICE
const expenseSlice = createSlice({
  name: "expense",

  initialState: {
    expenses: [],
    isLoading: false,
    isSubmitting: false,
    error: null,
  },

  reducers: {},

  extraReducers: (builder) => {
    builder

      // FETCH
      .addCase(fetchExpenses.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchExpenses.fulfilled, (state, action) => {
        state.isLoading = false;
        state.expenses = action.payload;
      })
      .addCase(fetchExpenses.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // CREATE
      .addCase(createExpense.pending, (state) => {
        state.isSubmitting = true;
      })

      .addCase(createExpense.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.expenses.unshift(action.payload);
      })

      .addCase(createExpense.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      })

      .addCase(editExpense.pending, (state) => {
        state.isSubmitting = true;
      })
      .addCase(editExpense.fulfilled, (state, action) => {
        state.isSubmitting = false;

        const updatedExpense = action.payload;
        const index = state.expenses.findIndex(
          (e) => e?.id === updatedExpense?.id,
        );

        if (index !== -1) {
          state.expenses[index] = updatedExpense;
        }
      })
      .addCase(editExpense.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      });
  },
});

export default expenseSlice.reducer;
