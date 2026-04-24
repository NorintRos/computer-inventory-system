require('dotenv').config();
const express = require('express');
const { engine } = require('express-handlebars');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const methodOverride = require('method-override');
const session = require('express-session');
const flash = require('connect-flash');
const helmet = require('helmet');
const cors = require('cors');
const connectDB = require('./config/db');
const corsOptions = require('./config/cors');
const sessionConfig = require('./config/session');
const rateLimiter = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const hbsHelpers = require('./helpers/hbs');

const app = express();

// Connect DB
connectDB();

// View engine
app.engine(
  'hbs',
  engine({
    extname: '.hbs',
    defaultLayout: 'main',
    helpers: hbsHelpers,
  }),
);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride('_method'));
app.use(rateLimiter);
app.use(express.static(path.join(__dirname, 'public')));

// Session (for flash messages)
app.use(session(sessionConfig));
app.use(flash());

// Make flash messages available in all HBS templates
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// API routes
app.use('/api/auth', require('./routes/api/auth'));
app.use('/api/users', require('./routes/api/users'));
app.use('/api/items', require('./routes/api/items'));
app.use('/api/keys', require('./routes/api/keys'));
app.use('/api/transactions', require('./routes/api/transactions'));

// UI routes
app.use('/', require('./routes/ui/index'));
app.use('/auth', require('./routes/ui/auth'));
app.use('/items', require('./routes/ui/items'));
app.use('/users', require('./routes/ui/users'));
app.use('/keys', require('./routes/ui/keys'));
app.use('/transactions', require('./routes/ui/transactions'));
app.use('/history', require('./routes/ui/history'));
app.use('/reports', require('./routes/ui/reports'));

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app; // Export for supertest
