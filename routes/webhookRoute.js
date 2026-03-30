
var express = require('express');
var router = express.Router();
const crypto = require("crypto");
const bodyParser = require('body-parser');
var logger = require('../log.js');

const { subscribe, unsubscribe, getStatus } = require('../public/javascripts/api/webex.js')
const { findSubscription, updateSubDatabase } = require('../public/javascripts/db/subscriptionDb.js')
const { proccessRecording } = require('../public/javascripts/api/processRecordings.js')
const jsonParser = bodyParser.json();

//var app = require('../index');

// WebEx Oauth Redirect
router.get("/oauth/redirect", (req, res) => {
    logger.debug("/oath/redirect - Redirect received");
    const auth_code = req.query.code || null;
    if (auth_code == null) {
        logger.warn("Code not received from WebEx ID Broker.  Cannot register web hooks.");
        res.redirect("/index.html");
        return;
    }

    logger.debug("/oauth/redirect - Received client code: " + auth_code);

    retrieveAccessToken(auth_code).then((data) => {
        logger.debug("/oauth/redirect - token_promise resolved - " + data.access_token);
        access_token = data.access_token
        logger.debug("/oauth/redirect - received token - " + access_token);
        code = auth_code;
        refresh_token = data.refresh_token;
        setTimeout(refreshAccessToken, data.expires_in * 1000);
        logger.info("/oauth/redirect - Access token received");
        res.redirect("/index.html");
        return;
    }).catch((error) => {
        access_token = null;
        refresh_token = null;
        code = null;
        logger.warn("/oauth/redirect - No access token received");
        res.redirect("/index.html");
        return;
    });
});

// WebEx Webhooks
router.post("/webhook", jsonParser, async (req, res) => {
    const body = req.body;
    const orgId = body.comciscoorgid;
    const subscriptionId = req.body.source.slice(
        req.body.source.lastIndexOf("/") + 1
    );
    const secret = (subscriptionId, WXCC_WEBHOOK_SECRET);
    //hash = crypto
    //    .createHmac("sha256", secret)
    //    .update(req.rawBody)
    //    .digest("hex");

    //const signature = req.headers["x-webexcc-signature"];

    //if (signature !== hash) {
    //  logger.warn("The secrets did not match. Aborting.", signature, hash);
    //  // Webhook was received, so give 200 response.
    //  res.status(401).send();
    //  return; // stop processing
    //}

    let payload = req.body;
    logger.debug("/webhook - Received payload - " + JSON.stringify(payload));
    if (payload.type != "capture:available") {
        logger.warn("/webhook - Webhook received with no recording available.  Discarding.");
        res.sendStatus(200);
        return
    }
    retval = await proccessRecording(payload);
    res.sendStatus(200);
    return;
});

// Authentication Status Endpoint
//router.get("/webhook", async(req, res) => {
//    logger.info("/Webhook get - Get");
//    res.sendStatus(400);
//    return;
//});

// Authentication Status Endpoint
router.get("/status", async (req, res) => {
    logger.info("/status - Get Status");
    const response = await getStatus();
    res.json(response);

});

// Server Logoff Endpoint
router.get("/logoff", (req, res) => {
    SUBSCRIPTION_ID
    logger.info("/logoff - server logoff initiated");
    if (access_token != null) {
        const response = unsubscribe(access_token);
        response.then(() => {
            access_token = null;
            code = null;
            refresh_token = null;
        });
    }
    res.status(200);
    res.end();
});

// Subscription Management Endpoints
router.get("/subscribe", async (req, res) => {
    //check if already subscribed
    logger.info("/subscribe - Creating Subscription");
    let subscriptions = await findSubscription();
    if (subscriptions.length != 0) {
        SUBSCRIPTION_ID = subscriptions;
    };

    if (SUBSCRIPTION_ID != null) {
        logger.warn("/subscribe - Already subscribed");
        res.status(400);
        res.send({ "error": "subscription already exists" });
        return;
    }
    const response = await subscribe();

    if (response != null) {
        if (response != false) {
            updateSubDatabase(response);
            res.json({ "status": "subscribed", "subscriptionId": SUBSCRIPTION_ID });

        } else {
            res.json({ "status": "unsubscribed", "error": "subscribe failed" });
        }
    };
});
/**Unscubscribe Endpoint */
router.get("/unsubscribe", (req, res) => {
    logger.info("/unsubscribe - Removing Subscription");
    if (SUBSCRIPTION_ID == null) {
        logger.warn("/unsubscribe - Already unsubscribed");
        res.status(400);
        res.send({ "error": "no subscription present" });
        return;
    }
    const response = unsubscribe();
    response.then((response) => {
        if (response) {
            res.json({ "status": "unsubscribed" });
        } else {
            res.json({ "status": "subscribed", "error": "unsubscribe failed" });
        }
    });
});

module.exports = router;