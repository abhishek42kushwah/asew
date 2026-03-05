import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import delegationReducer from './slices/delegationSlice';
import checklistReducer from './slices/checklistSlice';
import masterReducer from './slices/masterSlice';
import todoReducer from './slices/todoSlice';
import helpTicketConfigReducer from './slices/helpTicketConfigSlice';
import expenseReducer  from "./slices/expenseSlice"
import momReducer from './slices/momSlice';
import vendorsReducer from './slices/vendorsSlice';
import scoreReducer from './slices/scoreSlice';
export const store = configureStore({
    reducer: {
        auth: authReducer,
        delegation: delegationReducer,
        checklist: checklistReducer,
        master: masterReducer,
        todo: todoReducer,
        helpTicketConfig:helpTicketConfigReducer,
        expense:expenseReducer,
        mom:momReducer,
        vendors:vendorsReducer,
        score:scoreReducer
    },
});
