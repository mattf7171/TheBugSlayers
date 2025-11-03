const express = require("express");
const routes = express.Router();

// Session set, get, and delete from video
routes.route("/session_set").get(async function (req, res) {
    console.log("In /session_set, session is: " + JSON.stringify(req.session));
    let status = "";
    if (!req.session.username ) {
        req.session.username = "brad";
        status = "Session set";
        console.log(status)
    } else {
        status = "Session already existed";
        console.log(status);
    }
    const resultObj = { status: status };

    res.json(resultObj);
});

routes.route("/session_get").get(async function (req, res) {
    console.log("In /session_get, session is: " + JSON.stringify(req.session));
    let status = "";
    if (!req.session.username ) {
        status = "No session set";
        console.log(status)
    } else {
        status = "Session username is: " + req.session.username;
        console.log(status);
    }
    const resultObj = { status: status };

    res.json(resultObj);
});

routes.route("/session_delete").get(async function (req, res) {
    console.log("In /session_delete, session is: " + JSON.stringify(req.session));
    req.session.destroy();
    
    let status = "No session set";
    
    const resultObj = { status: status };

    res.json(resultObj);
});

module.exports = routes;