import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../../config";

const API_URL = `${API_BASE_URL}/api/mom`;


export const fetchMOM = createAsyncThunk(
  "mom/fetchMOM",
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
        error.response?.data?.message || "Failed to fetch MOM"
      );
    }
  }
);


export const createMOM = createAsyncThunk(
  "mom/createMOM",
  async (momData, { getState, rejectWithValue }) => {
    const { token } = getState().auth;

    try {
      const res = await axios.post(API_URL, momData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      return res.data.mom;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to create MOM"
      );
    }
  }
);


export const editMOM = createAsyncThunk(
  "mom/editMOM",
  async ({ id, updatedData }, { getState, rejectWithValue }) => {
    const { token } = getState().auth;

    try {
      const res = await axios.put(`${API_URL}/${id}`, updatedData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      return res.data.mom;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to edit MOM"
      );
    }
  }
);



const momSlice = createSlice({
  name: "mom",

  initialState: {
    momList: [],
    isLoading: false,
    isSubmitting: false,
    error: null,
  },

  reducers: {},

  extraReducers: (builder) => {
    builder

      // ✅ FETCH MOM
      .addCase(fetchMOM.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchMOM.fulfilled, (state, action) => {
        state.isLoading = false;
        state.momList = action.payload;
      })
      .addCase(fetchMOM.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })


      // ✅ CREATE MOM
      .addCase(createMOM.pending, (state) => {
        state.isSubmitting = true;
      })
      .addCase(createMOM.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.momList.unshift(action.payload);
      })
      .addCase(createMOM.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      })


      // ✅ EDIT MOM
      .addCase(editMOM.pending, (state) => {
        state.isSubmitting = true;
      })
      .addCase(editMOM.fulfilled, (state, action) => {
        state.isSubmitting = false;

        const updatedMOM = action.payload;

        const index = state.momList.findIndex(
          (m) => m?._id === updatedMOM?._id
        );

        if (index !== -1) {
          state.momList[index] = updatedMOM;
        }
      })
      .addCase(editMOM.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      });
  },
});

export default momSlice.reducer;
