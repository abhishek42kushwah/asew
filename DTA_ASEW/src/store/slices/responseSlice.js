import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../../config";

const API_URL = `${API_BASE_URL}/api/response`;

export const fetchResponses = createAsyncThunk(
  "response/fetchResponses",
  async (quotationNo, { rejectWithValue }) => {
    try {
      const url = quotationNo
        ? `${API_URL}?quotationNo=${quotationNo}`
        : API_URL;
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch responses",
      );
    }
  },
);

export const createResponse = createAsyncThunk(
  "response/createResponse",
  async (responseData, { rejectWithValue }) => {
    try {
      const response = await axios.post(API_URL, responseData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to create response",
      );
    }
  },
);

const responseSlice = createSlice({
  name: "response",
  initialState: {
    responses: [],
    isLoading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchResponses.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchResponses.fulfilled, (state, action) => {
        state.isLoading = false;
        state.responses = action.payload.data;
      })
      .addCase(fetchResponses.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(createResponse.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createResponse.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(createResponse.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export default responseSlice.reducer;
