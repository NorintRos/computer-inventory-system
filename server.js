const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

// Fail fast on missing critical env vars (from master — catches config drift early).
['MONGODB_URI', 'JWT_SECRET', 'SESSION_SECRET'].forEach((key) => {
  const v = process.env[key];
  if (!v || typeof v !== 'string' || !v.trim()) {
    console.error(`Missing or empty ${key} in .env (see .env.example)`);
    process.exit(1);
  }
});

const express = require('express');
const { engine } = require('express-handlebars');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
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
const { attachUser } = require('./middleware/uiAuth');
const hbsHelpers = require('./helpers/hbs');

const app = express();

app.set('trust proxy', 1); // Railway sits behind a proxy

connectDB();

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

app.use(helmet());
app.use(morgan('combined'));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(attachUser);

const OVERRIDE_METHODS = new Set(['PUT', 'PATCH', 'DELETE']);
app.use(
  methodOverride((req) => {
    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
      const method = String(req.body._method).toUpperCase();
      delete req.body._method;
      return OVERRIDE_METHODS.has(method) ? method : undefined;
    }
  }),
);
app.use(
  methodOverride((req) => {
    if (req.query && '_method' in req.query) {
      const method = String(req.query._method).toUpperCase();
      delete req.query._method;
      return OVERRIDE_METHODS.has(method) ? method : undefined;
    }
  }),
);
app.use(express.static(path.join(__dirname, 'public')));
app.use(rateLimiter);

app.use(session(sessionConfig));
app.use(flash());

app.use((req, res, next) => {
  const success = req.flash('success');
  const error = req.flash('error');
  res.locals.success = success.length ? success.join(' ') : undefined;
  res.locals.error = error.length ? error.join(' ') : undefined;
  next();
});

app.use('/api/auth', require('./routes/api/auth'));
app.use('/api/users', require('./routes/api/users'));
app.use('/api/items', require('./routes/api/items'));
app.use('/api/keys', require('./routes/api/keys'));
app.use('/api/transactions', require('./routes/api/transactions'));
app.use('/api/files', require('./routes/api/files'));

app.use('/', require('./routes/ui/index'));
app.use('/auth', require('./routes/ui/auth'));
app.use('/items', require('./routes/ui/items'));
app.use('/users', require('./routes/ui/users'));
app.use('/keys', require('./routes/ui/keys'));
app.use('/transactions', require('./routes/ui/transactions'));
app.use('/history', require('./routes/ui/history'));
app.use('/reports', require('./routes/ui/reports'));

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app; // Export for supertest
