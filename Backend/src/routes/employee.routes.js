const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employee.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.get('/employees', verifyToken, employeeController.getAllEmployees);
router.get('/departments', verifyToken, employeeController.getDepartments);
router.get('/pc-accountables', verifyToken, employeeController.getPCAccountables);
router.get('/problem-solvers', verifyToken, employeeController.getProblemSolvers);
router.get('/locations', verifyToken, employeeController.getLocations);
router.get('/projects',verifyToken,employeeController.getProjects);
router.get('/vendor-categories', verifyToken,employeeController.getVendorCategories);
module.exports = router;
