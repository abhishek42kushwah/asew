require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Main Route
app.get('/', (req, res) => {
    res.send('ERP Backend is running');
});

// Import Models & Routes
const { createEmployeeSheet } = require('./src/models/employee.model');
const { createItemMasterSheet } = require("./src/models/ItemMaster.model")
const { createCustomerSheet } = require("./src/models/customer.model")
const {createSaveSheet} = require("./src/models/save.model")

const authRoutes = require('./src/routes/auth.routes');
const employeeRoutes = require('./src/routes/employee.routes');
const itemRoutes = require('./src/routes/item.routes');
const customerRoutes = require('./src/routes/customer.routes');
const saveRoutes = require('./src/routes/save.routes');


// Routes registration
app.use('/api/auth', authRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/item', itemRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/save',saveRoutes)
const fs = require('fs');
if (fs.existsSync('uploads')) {
    app.use('/uploads', express.static('uploads'));
}

// Initialize Database Tables
Promise.all([
    createEmployeeSheet(),
createItemMasterSheet(),
createCustomerSheet(),
createSaveSheet()
])
    .then(() => {
        console.log('Database synchronization complete');
    })
    .catch(err => console.error('Database synchronization failed:', err));

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}



module.exports = app;
