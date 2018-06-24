'use strict';
const Influx = require('influx');
const http = require('https');
const moment = require('moment');
const fs = require('fs');

// Input parameters
let configFile = "./config.json";
let config = {};

// Check if a config file was specified
if (process.argv.length > 2) {
    configFile = process.argv[2];
}

// Read the config file if it exists
if(fs.existsSync(configFile)){
    console.log("Loading config file: " + configFile);
    config = require(configFile);
    if(config.uptimerobot && config.uptimerobot.apiKey !== undefined){
        console.warn("uptimerobot.apiKey is deprecated, use uptimerobot.api_key instead");
        config.uptimerobot.api_key = config.uptimerobot.apiKey;
    }
}
else{
    console.log("Config file not found, depending on environment variables");
}

// Read environment variables
// Poor man's config setup
config.application = config.application || {};
config.uptimerobot = config.uptimerobot || {};
config.influx = config.influx || {};
if(process.env.APPLICATION_INTERVAL !== undefined) {
    config.application.interval = process.env.APPLICATION_INTERVAL;
}
if(process.env.UPTIMEROBOT_API_KEY !== undefined) {
    config.uptimerobot.api_key = process.env.UPTIMEROBOT_API_KEY;
}
if(process.env.UPTIMEROBOT_LOGS_LIMIT !== undefined) {
    config.uptimerobot.logs_limit = process.env.UPTIMEROBOT_LOGS_LIMIT;
}
if(process.env.UPTIMEROBOT_RESPONSE_TIMES_LIMIT !== undefined) {
    config.uptimerobot.response_times_limit = process.env.UPTIMEROBOT_RESPONSE_TIMES_LIMIT;
}
if(process.env.INFLUX_HOST !== undefined) {
    config.influx.host = process.env.INFLUX_HOST;
}
if(process.env.INFLUX_PORT !== undefined) {
    config.influx.port = process.env.INFLUX_PORT;
}
if(process.env.INFLUX_PROTOCOL !== undefined) {
    config.influx.protocol = process.env.INFLUX_PROTOCOL;
}
if(process.env.INFLUX_USERNAME !== undefined) {
    config.influx.username = process.env.INFLUX_USERNAME;
}
if(process.env.INFLUX_PASSWORD !== undefined) {
    config.influx.password = process.env.INFLUX_PASSWORD;
}
if(process.env.INFLUX_DATABASE !== undefined) {
    config.influx.database = process.env.INFLUX_DATABASE;
}

const influxdb = new Influx.InfluxDB(config.influx);


/**
 * Gets the monitor data
 * @returns {Promise<any>}
 */
function getMonitors() {
    return new Promise((resolve, reject)=>{
        const options = {
            hostname: 'api.uptimerobot.com',
            port: 443,
            path: '/v2/getMonitors',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const postData = {
            response_times: "1",
            response_times_limit: config.uptimerobot.response_times_limit,
            timezone: "1",
            format: "json",
            logs: "1",
            logs_limit: config.uptimerobot.logs_limit,
            api_key: config.uptimerobot.api_key
        };

        const req = http.request(options, (response) => {
            let objectString = "";
            response.on('data', (chunk) => {
                objectString += chunk;
            });

            response.on('end', () => {
                const responseData = JSON.parse(objectString);
                resolve(responseData.monitors);
            });
        });
        req.write(JSON.stringify(postData));
        req.end();
    });

}

function processMonitors(monitors){
    if(monitors === undefined){
        console.warn("Could not find any monitors");
        return;
    }

    monitors.forEach((monitor) => {

        /*********************************************************************
         *  Response times
         ********************************************************************/
        const responseTimes = monitor.response_times;
        const responseTimePoints = [];
        responseTimes.forEach(function(rt) {
            const timestamp = moment.unix(rt.datetime);
            responseTimePoints.push({
                measurement : 'response_times',
                tags : {
                    id : monitor.id,
                    friendlyname : monitor.friendly_name
                },
                fields: {
                    value : rt.value,
                    time : timestamp.valueOf()
                },
            });
        });

        influxdb.writePoints(responseTimePoints)
            .then(() => {}, error => console.warn(error));

        /*********************************************************************
         *  Monitor logs
         ********************************************************************/
        const logs = monitor.logs;
        const logTimePoints = [];

        logs.forEach((log) => {
            const timestamp = moment.unix(log.datetime);
            logTimePoints.push({
                measurement : "logs",
                tags : {
                    id : monitor.id,
                    friendlyname : monitor.friendly_name
                },
                fields : {
                    type : log.type,
                    time : timestamp.valueOf(),
                    reason : (log.reason.code === undefined || log.reason.code == null) ? "" : "" + log.reason.code,
                    reason_detail : (log.reason.detail === undefined || log.reason.detail == null) ? "" : log.reason.detail
                }
            });
        });

        influxdb.writePoints(logTimePoints)
            .then(() => {}, error => console.warn(error));
    });
}

getMonitors()
    .then(processMonitors);

// If there is an interval configured, keep running at the interval
if(config.application.interval !== undefined && config.application.interval > 0){
    setInterval(() => {
        getMonitors()
            .then(processMonitors);
    }, config.application.interval * 1000);

}
