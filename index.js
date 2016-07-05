'use strict';
var influx = require('influx'),
  uptimerobot = require('uptime-robot'),
  moment = require('moment');

// Input parameters
var configFile = "./config.json"

// Check if a config file was specified
if(process.argv.length > 2){
  configFile = process.argv[2];
}

// Read the config
var config = require(configFile);

// Create uptime-robot client
var uptimeclient = new uptimerobot(config.uptimerobot.apikey);
var influxdb = influx(config.influx);


uptimeclient.getMonitors({responseTimes  : true}).then(function(monitors){
   console.log(JSON.stringify(monitors), null, 4);
  var monitor = monitors[0];
  var responseTimes = monitor.responsetime;
  var responseTimePoints = [];
  responseTimes.forEach(function(rt){
    var point = [];
    var timestamp = moment(rt.datetime, "MM/DD/YYYY HH:mm:ss");
    // The value
    point[0] = {value : Number(rt.value), time: timestamp.utc().valueOf()};

    // The tags
    point[1] = {id : monitor.id, friendlyname: monitor.friendlyname};

    responseTimePoints.push(point);
  });
  console.log(responseTimePoints);
  // Now lets write this server's points
  influxdb.writePoints("responseTime", responseTimePoints, function(err, response){
    console.log(err);
    console.log(response);

  });
});
