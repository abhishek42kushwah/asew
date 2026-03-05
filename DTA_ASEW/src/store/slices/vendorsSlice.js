import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../../config";

const API_URL = `${API_BASE_URL}/api/vendors`;

/* ===================================================== */
/* ✅ FETCH VENDORS */
/* ===================================================== */
export const fetchVendors = createAsyncThunk(
  "vendor/fetchVendors",
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
        error.response?.data?.message || "Failed to fetch vendors"
      );
    }
  }
);

/* ===================================================== */
/* ✅ CREATE VENDOR */
/* ===================================================== */
export const createVendor = createAsyncThunk(
  "vendor/createVendor",
  async (vendorData, { getState, rejectWithValue }) => {
    const { token } = getState().auth;

    try {
      const res = await axios.post(API_URL, vendorData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data", // ✅ File Upload
        },
      });

      return res.data.vendor;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to create vendor"
      );
    }
  }
);

/* ===================================================== */
/* ✅ EDIT VENDOR */
/* ===================================================== */
export const editVendor = createAsyncThunk(
  "vendor/editVendor",
  async ({ id, updatedData }, { getState, rejectWithValue }) => {
    const { token } = getState().auth;

    try {
      const res = await axios.put(`${API_URL}/${id}`, updatedData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data", // ✅ File Upload
        },
      });

      return res.data.vendor;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to edit vendor"
      );
    }
  }
);

/* ===================================================== */
/* ✅ VENDOR SLICE */
/* ===================================================== */
const vendorSlice = createSlice({
  name: "vendor",

  initialState: {
    vendorList: [],
    isLoading: false,
    isSubmitting: false,
    error: null,
  },

  reducers: {},

  extraReducers: (builder) => {
    builder

      /* ============================= */
      /* ✅ FETCH VENDORS */
      /* ============================= */
      .addCase(fetchVendors.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchVendors.fulfilled, (state, action) => {
        state.isLoading = false;
        state.vendorList = action.payload;
      })
      .addCase(fetchVendors.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      /* ============================= */
      /* ✅ CREATE VENDOR */
      /* ============================= */
      .addCase(createVendor.pending, (state) => {
        state.isSubmitting = true;
      })
      .addCase(createVendor.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.vendorList.unshift(action.payload);
      })
      .addCase(createVendor.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      })

      /* ============================= */
      /* ✅ EDIT VENDOR */
      /* ============================= */
      .addCase(editVendor.pending, (state) => {
        state.isSubmitting = true;
      })
      .addCase(editVendor.fulfilled, (state, action) => {
        state.isSubmitting = false;

        const updatedVendor = action.payload;

        const index = state.vendorList.findIndex(
          (v) => v?._id === updatedVendor?._id
        );

        if (index !== -1) {
          state.vendorList[index] = updatedVendor;
        }
      })
      .addCase(editVendor.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      });
  },
});

export default vendorSlice.reducer;
