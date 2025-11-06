// ...existing code...
const https = require('https');
const http = require('http');
const fs = require('fs');
const express = require('express');
const logger = require('./log.js');
const cookieParser = require('cookie-parser');
const path = require('path');
const cors = require('cors');

const { initializeScheduler } = require('./public/javascripts/scheduler/scheduler.js');
const tokenRouter = require('./routes/tokenRoute.js');
const webhookRouter = require('./routes/webhookRoute.js');
const tsRouter = require('./routes/telephonic-signature.js');

const app = express();

// Gather Environment from file (keep same globals as before)
global.WXCLIENT_ID = process.env["npm_config_wxcc_wxclient_id"] || process.env["wxcc_wxclient_id"] || null;
global.WXCLIENT_SECRET = process.env["npm_config_wxcc_wxclient_secret"] || process.env["xcc_wxclient_secret"] || null;
global.WXCLIENT_ORGID = process.env["npm_config_wxcc_orgid"] || process.env["wxcc_orgid"] || null;
global.CACLIENT_ID = process.env["npm_config_calsaws_client_id"] || process.env["calsaws_client_id"] || null;
global.CACLIENT_SECRET = process.env["npm_config_calsaws_client_secret"] || process.env["calsaws_client_secret"] || null;
global.CACLIENT_SCOPE = process.env["npm_config_calsaws_client_scope"] || process.env["calsaws_client_scope"] || null;
global.LOG_LEVEL = process.env["npm_config_log_level"] || process.env["log_level"] || "info";
global.WEBHOOK_PATH = "/webhook/webhook";
global.WEBHOOK_URL = process.env["npm_config_webhook_url"] || process.env["webhook_url"] || null;
global.WXAUTH_URL = process.env["npm_config_wxauth_url"] || process.env["wxauth_url"];
global.CAAUTH_URL = process.env["npm_config_caauth_url"] || process.env["caauth_url"];
global.WXCC_WEBHOOK_SECRET = process.env["npm_config_wxcc_webhook_secret"] || process.env["wxcc_webhook_secret"] || null;
global.WXCC_REFRESH_TOKEN = process.env["npm_config_wxcc_refresh_token"] || process.env["wxcc_refresh_token"] || null;
global.subscription_Id = null;
global.IDLE_TIMER = process.env["npm_config_idle_timer"] || process.env["idle_timer"] || 0;
global.LISTEN_PORT = process.env["npm_config_listen_port"] || process.env["listen_port"] || 8443;
global.CLEAR_DB_ON_START = process.env["npm_config_clear_db_on_start"] || process.env["clear_db_on_start"] || 'false';
global.USESECURE = process.env["npm_config_usesecure"] || process.env["usesecure"] || 'false';
if (WEBHOOK_URL) WEBHOOK_URL = WEBHOOK_URL + WEBHOOK_PATH;

logger.info("Server starting");

process.on('uncaughtException', function(error){
  logger.error(error.stack);
});

// Check required config
(() => {
  if (WXCLIENT_ID == null) {
    logger.error("WXCC_WXCLIENT_ID not defined in npm config or environment.  Cannot run.");
    process.exit(-1);
  }
  if (WXCLIENT_ORGID == null) {
    logger.error("WXCLIENT_ORGID not defined in npm config or environment.  Cannot run.");
    process.exit(-1);
  }
  if (WXCLIENT_SECRET == null) {
    logger.error("WXCC_WXCLIENT_SECRET not defined in npm config or environment.  Cannot run.");
    process.exit(-1);
  }
  if (CACLIENT_ID == null) {
    logger.error("CACLIENT_ID not defined in npm config or environment.  Cannot run.");
    process.exit(-1);
  }
  if (CACLIENT_SECRET == null) {
    logger.error("CACLIENT_SECRET not defined in npm config or environment.  Cannot run.");
    process.exit(-1);
  }
  if (CACLIENT_SCOPE == null) {
    logger.error("CACLIENT_SCOPE not defined in npm config or environment.  Cannot run.");
    process.exit(-1);
  }
  logger.level = LOG_LEVEL;

  logger.info("LOG_LEVEL -" +  LOG_LEVEL);
  logger.info("WEBHOOK_URL -" +  WEBHOOK_URL);
  logger.info("WXCLIENT_ID -" +  WXCLIENT_ID);
  logger.info("WXCLIENT_ORGID -" + WXCLIENT_ORGID);
  logger.info("WXCLIENT_SECRET -" +  WXCLIENT_SECRET);
})();

process.on("SIGINT", (code) => {
  // optional unsubscribe wrapper if defined elsewhere
  if (typeof unsubscribe === 'function') {
    unsubscribe().then(() => {
      logger.info("process.exit hook - successfully unsubscribed WebEx webhooks");
      process.exit(0);
    }).catch(() => {
      logger.warn("process.exit hook - failed to unsubscribe WebEx webhooks");
      process.exit(-1);
    });
  } else {
    process.exit(0);
  }
});

try {
  initializeScheduler();

  // Body parsers
  app.use(
    express.json({
      verify: (req, res, buf, encoding) => {
        req.rawBody = buf.toString();
      }
    })
  );
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'ejs');

  // CORS configuration and middleware - must be applied BEFORE static handlers
  const allowedOrigins = [
    'http://localhost:3001',
    'http://localhost:8443',
    'https://desktop.wxcc-us1.cisco.com',
    'https://desktop.wxcc-eu1.cisco.com',
    'https://desktop.wxcc-eu2.cisco.com',
    'https://desktop.wxcc-anz1.cisco.com',
    'https://ec2-54-191-40-161.us-west-2.compute.amazonaws.com',
    'https://ubuntu-vmware-virtual-platform.tail4794a2.ts.net'
  ];

  const corsOptions = {
    origin: function (origin, callback) {
      // allow requests with no origin (curl, postman, servers)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS: ' + origin));
      }
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200,
    maxAge: 86400
  };

  // Explicit header middleware to ensure static assets get CORS headers too
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (!origin) return next();
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      // if you need cookies/credentials, enable the next header and set corsOptions.credentials = true
      // res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    // Preflight short-circuit
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Also register cors middleware (keeps express-consistent behavior)
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

 // Serve static build if present
  const publicBuildPath = path.join(__dirname, 'public', 'build');
  const hasBuild = fs.existsSync(publicBuildPath);
  if (hasBuild) {

    // --- expose stable CSS and JS endpoints for the host layout to reference ---
    try {
      const cssDir = path.join(publicBuildPath, 'static', 'css');
      if (fs.existsSync(cssDir)) {
        const cssFiles = fs.readdirSync(cssDir);
        const mainCss = cssFiles.find(f => /^main.*\.css$/.test(f));
        if (mainCss) {
          const cssPath = path.join(cssDir, mainCss);
          app.get('/tsforms-widget.styles.css', (req, res) => {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
            res.sendFile(cssPath, (err) => {
              if (err) {
                logger.error('Error sending css bundle:', err);
                res.sendStatus(500);
              }
            });
          });
          logger.debug('✓ Exposed /tsforms-widget.styles.css -> ' + cssPath);
        } else {
          logger.warn('No main.*.css found in ' + cssDir);
        }
      } else {
        logger.warn('CSS directory does not exist: ' + cssDir);
      }
    } catch (e) {
      logger.warn('Could not expose widget CSS route:', e.message);
    }

    // JS route (if not already present) - kept for completeness
    try {
      const jsDir = path.join(publicBuildPath, 'static', 'js');
      if (fs.existsSync(jsDir)) {
        const files = fs.readdirSync(jsDir);
        const mainFile = files.find(f => /^main.*\.js$/.test(f));
        if (mainFile) {
          const bundlePath = path.join(jsDir, mainFile);
          app.get('/tsforms-widget.bundle.js', (req, res) => {
            res.type('application/javascript; charset=utf-8');
            res.sendFile(bundlePath, (err) => {
              if (err) {
                logger.error('Error sending bundle:', err);
                res.sendStatus(500);
              }
            });
          });
          logger.debug('✓ Exposed /tsforms-widget.bundle.js -> ' + bundlePath);
        }
      }
    } catch (e) {
      logger.warn('Could not expose widget JS route:', e.message);
    }

    // then serve static normally
    app.use(express.static(publicBuildPath));
    logger.debug('✓ Serving static build files from: ' + publicBuildPath);
  }

  // Routes
  app.use('/webhook', webhookRouter);
  app.use('/token', tokenRouter);
  app.use('/telephonic-signature', tsRouter);

  // Root health/info route
  app.get('/', (req, res) => {
    res.json({
      name: 'TSForms API Server',
      status: 'running',
      mode: hasBuild ? 'production' : 'development',
      message: hasBuild ? 'Serving React app' : 'Start React client separately on port 3001',
      endpoints: {
        health: 'GET /telephonic-signature/api/health',
        start: 'POST /telephonic-signature/api/recording/start',
        stop: 'POST /telephonic-signature/api/recording/stop',
        list: 'GET /telephonic-signature/api/recordings'
      }
    });
  });

  // Error handler
  app.use(function(err, req, res, next) {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.status(err.status || 500);
    res.render('error');
  });

  // Start server
  app.listen(LISTEN_PORT, '0.0.0.0', () => {
    logger.debug(`\n🚀 TSForms server running on port ${LISTEN_PORT}`);
    logger.debug(`📡 API: http://localhost:${LISTEN_PORT}/telephonic-signature/api`);
    console.log(`\n🚀 TSForms server running on port ${LISTEN_PORT}`);
    console.log(`📡 API: http://localhost:${LISTEN_PORT}/telephonic-signature/api`);
    if (hasBuild) {
      logger.debug(`✓ PRODUCTION mode - serving React app at http://localhost:${LISTEN_PORT}`);
      console.log(`✓ PRODUCTION mode - serving React app at http://localhost:${LISTEN_PORT}`);
    } else {
      logger.debug(`⚠️  DEVELOPMENT mode - start React separately: cd client && npm start`);
      console.log(`⚠️  DEVELOPMENT mode - start React separately: cd client && npm start`);
    }
  });

} catch (error) {
  logger.error("Error opening Server - " +  error);
  console.log("Error opening Server - " +  error);
}

module.exports = { app };
// ...existing code...