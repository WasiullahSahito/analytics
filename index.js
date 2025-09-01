require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const connectDB = require('./src/config/db');
const initializeJobs = require('./src/jobs');

const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => res.send('Analytics API Running'));
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/analytics', require('./src/routes/analytics'));

// Initialize Cron Jobs
initializeJobs();

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

module.exports = app; // For testing