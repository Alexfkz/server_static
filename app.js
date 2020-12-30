if (typeof console_stamp_init === 'undefined') {
  require('console-stamp')(console, {
    metadata: function () {
      console_stamp_init      = 1;
      const orig              = Error.prepareStackTrace;
      Error.prepareStackTrace = function (_, stack) {
        return stack;
      };
      const err               = new Error;
      Error.captureStackTrace(err, arguments.callee);
      const stack             = err.stack;
      Error.prepareStackTrace = orig;
      return ('[' + stack[1].getFileName() + ':' + stack[1].getLineNumber() + ']' + '\n');
    },
    colors  : {
      stamp   : 'yellow',
      label   : 'white',
      metadata: 'green'
    },
    // exclude: isDebug || isLocalProduct ? [] : ["log", "info", "warn", "error", "dir", "assert"],
  });
}

const createError  = require('http-errors');
const cors         = require('cors');
const express      = require('express');
const path         = require('path');
const cookieParser = require('cookie-parser');
const logger       = require('morgan');

const indexRouter = require('./routes/index');

const app = express();

// const whitelist   = [
//   'https://my.keira.bot',
//   'https://static1.keira.bot'
// ];
// const corsOptions = {
//   origin     : function (origin, callback) {
//     if (whitelist.indexOf(origin) !== -1) {
//       callback(null, true)
//     } else {
//       callback(new Error('Not allowed by CORS'))
//     }
//   },
//   credentials: true
// };
app.use(cors({credentials: true}));
app.options('*', cors({credentials: true}));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'twig');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error   = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
