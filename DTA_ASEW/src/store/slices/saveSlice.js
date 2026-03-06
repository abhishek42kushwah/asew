import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../../config";

const API_URL = `${API_BASE_URL}/api/save`;

export const fetchSaves = createAsyncThunk(
  "save/fetchSaves",
  async (quotationNo, { rejectWithValue }) => {
    try {
      const url = quotationNo
        ? `${API_URL}?quotationNo=${quotationNo}`
        : API_URL;
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch saves",
      );
    }
  },
);

export const createSave = createAsyncThunk(
  "save/createSave",
  async (saveData, { rejectWithValue }) => {
    try {
      const response = await axios.post(API_URL, saveData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to create save",
      );
    }
  },
);

const saveSlice = createSlice({
  name: "save",
  initialState: {
    saves: [],
    isLoading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSaves.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSaves.fulfilled, (state, action) => {
        state.isLoading = false;
        state.saves = action.payload.data;
      })
      .addCase(fetchSaves.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(createSave.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createSave.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(createSave.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export default saveSlice.reducer;
