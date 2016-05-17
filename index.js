/*
 * Notifications (N!) Software
 * Creator: Joarc (Joar Classon)
 * Copyright Joar Classon
 */
// Load required libraries
var express = require("express");
var session = require("express-session");
var bodyParser = require('body-parser');
var pathlib = require("path");
var ws = require("nodejs-websocket");
var casual = require("casual");
var MongoStore = require('connect-mongo')(session);
var Mongo = require('mongodb').Db;
var MongoServer = require('mongodb').Server;

// Start express
var app = express();

// var
var path = pathlib.join(__dirname+"/public/");
var mongopath = "mongodb://localhost:27017/notifications";
var authenticationKeys = {};

// Enable special things with express
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// Static cache
app.use("/static", express.static("static"));

// Settings
//app.use(express.json());
app.use(session({
  secret: "asdfasdf",
  resave: true,
  saveUninitialized: true,
  store: new MongoStore({ url: mongopath })
  //cookie: {maxAge: 600000}
}));
app.disable("x-powered-by");
app.enable("trust proxy");

// Generic Functions
function grs(length) {
  var s = "";
  for (var i = 0; i <= length; i++) {
    s = s+casual.letter;
  }
  return s;
}
function addAuthKey(username) {
  var authKey = {username: username, key: grs(100), time: 10};
  authenticationKeys[username] = authKey;
  return authKey;
}
function checkPassword(pass, dbpass) {
  if (pass == dbpass) {
    return true;
  } else {
    return false;
  }
}
/*function addAlert(type, msg, to){
  loggedInUsers[to][notifications][loggedInUsers[to][notifications].length+1] = {type: type, msg: msg};
}*/

// Router
/*app.get('/', function (req, res) {
  res.sendFile("index.html", {root: __dirname + "/public/"});
});*/

app.get("/t", function(req,res){
  addAuthKey("asdf");
  res.send("asdf");
});

// Auth keys
setInterval(function(){
  //console.log("AuthKey ticking");
  //console.log(authenticationKeys);
  for (username in authenticationKeys) {
    if (authenticationKeys[username].time == 0) {
      delete authenticationKeys[username];
    } else {
      authenticationKeys[username].time -= 1;
    }
  }
}, 999);

// MongoDB
var db = new Mongo("notifications", new MongoServer("localhost", 27017, {auto_reconnect: true}), {w: 1});
db.open(function(e, d){
  if (e) {
    console.log(e);
  } else {
    console.log("MongoDB: Connected to database notifications");
  }
});

app.get("/logout", function(req, res){
  req.session.authenticated = false;
  req.session.data = {};
  res.redirect("/");
});

app.get("/reg", function(req, res){
  db.collection('users').insertOne({username: "joarc", password: "asdfasdf"});
  res.send("adding joarc:asdfasdf");
});

app.get("/login", function(req, res){
  res.sendFile(path+"login.html");
});
app.post("/login", function(req, res){
  if (db.collection('users').findOne({username:req.body.username}, {}, function(e,o){
    if (o == null) {
      req.session.authenticated = false;
      req.session.data = {};
      res.send({success: false});
    } else {
      if (checkPassword(req.body.password, o.password)) {
        req.session.authenticated = true;
        req.session.data = {username: o.username};
        addAuthKey(o.username);
        res.send({success: true});
      } else {
        req.session.authenticated = false;
        req.session.data = {};
        res.send({success: false});
      }
    }
  }));
});

app.get("/", function(req, res){
  if (req.session.authenticated !== undefined) {
    if (req.session.authenticated) {
      res.sendFile(path+"index_loggedin.html");
    } else {
      res.sendFile(path+"index_notloggedin.html");
    }
  } else {
    res.sendFile(path+"index_notloggedin.html");
  }
});

app.get("/data", function(req, res){
  if (req.session.authenticated) {
    if (authenticationKeys[req.session.data.username] == undefined) {
      res.send({type:"error", msg:"no-key-found"});
      return;
    }
    var authKey = authenticationKeys[req.session.data.username].key;
    res.send({username:req.session.data.username, key:authKey});
  } else {
    res.send({type:"error", msg:"not-authenticated"});
  }
});

app.use(function(req, res, next){
  res.status(404).sendFile(path+"404.html");
});

// Websocket Server
var server = ws.createServer(function(conn){
  //console.log(conn);
  conn.authenticated = false;
  conn.userdata = null;
  conn.on("text", function(str){
    str = JSON.parse(str);
    console.log(str);
    if (str.type == "authenticate") {
      if (conn.authenticated == false) {
        if (str.key == authenticationKeys[str.username].key) {
          authenticationKeys[str.username].time = 0;
        } else {
          conn.send(JSON.stringify({type: "alert", alert: {type:"danger", msg:"Error: Invalid AuthKey"}}));
        }
      } else {
        conn.send(JSON.stringify({type: "alert", alert: {type:"warning", msg:"Error: Already authenticated"}}));
      }
    } else {
      if (conn.authenticated == true) {
        if (str.type == "debug_alert") {
          if (str.msg != "") {
            conn.send(JSON.stringify({type: "alert", alert: {type:str.msg,msg:"Debug Alert"}}));
          } else {
            conn.send(JSON.stringify({type: "alert", alert: {type:"info",msg:"Debug Alert"}}));
          }
        }
      }
    }
  });
  conn.on("close", function(code, reason){
    console.log("Connection closed");
    conn.userdata = null;
  });
});

// Start listening
app.listen(8080, function (){
  console.log('Express Server started on port 8080');
});
server.listen(8081, function(){
  console.log("WebSocket Server started on port 8081");
});
