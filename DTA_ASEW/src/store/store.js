import { configureStore } from "@reduxjs/toolkit";
import customerReducer from "./slices/customerSlice";
import itemReducer from "./slices/itemSlice";
import saveReducer from "./slices/saveSlice";
import responseReducer from "./slices/responseSlice";

export const store = configureStore({
  reducer: {
    customer: customerReducer,
    item: itemReducer,
    save: saveReducer,
    response: responseReducer,
  },
});
