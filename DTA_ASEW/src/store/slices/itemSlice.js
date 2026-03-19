import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../../config";

const API_URL = `${API_BASE_URL}/api/item`;

export const fetchItems = createAsyncThunk(
  "item/fetchItems",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(API_URL);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch items",
      );
    }
  },
);

export const createItem = createAsyncThunk(
  "item/createItem",
  async (itemData, { rejectWithValue }) => {
    try {
      const response = await axios.post(API_URL, itemData, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to create item",
      );
    }
  },
);

export const updateItemMaster = createAsyncThunk(
  "item/updateItemMaster",
  async ({  itemData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(API_URL, itemData, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update item master",
      );
    }
  },
);

export const bulkUpdateItemMaster = createAsyncThunk(
  "item/bulkUpdateItemMaster",
  async ({ items }, { rejectWithValue }) => {
    try {
      const response = await axios.put(`${API_URL}/bulk`, { items }, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to bulk update items",
      );
    }
  },
);

const itemSlice = createSlice({
  name: "item",
  initialState: {
    items: [],
    isLoading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchItems.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchItems.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload;
      })
      .addCase(fetchItems.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(createItem.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createItem.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items.push(action.payload);
      })
      .addCase(createItem.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(updateItemMaster.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateItemMaster.fulfilled, (state, action) => {
        state.isLoading = false;
        // Optionally update the item in the list if needed
        const index = state.items.findIndex(
          (item) => item.ITEM_NAME === action.meta.arg.name,
        );
        if (index !== -1) {
          state.items[index] = {
            ...state.items[index],
            ...action.meta.arg.itemData,
          };
        }
      })
      .addCase(updateItemMaster.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(bulkUpdateItemMaster.fulfilled, () => {
        // Bulk update succeeded — no individual item tracking needed
      })
      .addCase(bulkUpdateItemMaster.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export default itemSlice.reducer;
