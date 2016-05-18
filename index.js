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
var fs = require("fs");

// Start express
var app = express();

// replaceAll
function replaceAll(target, search, replacement) {
    return target.replace(new RegExp(search, 'g'), replacement);
};

// var
var path = pathlib.join(__dirname+"/public/");
var mongopath = "mongodb://localhost:27017/notifications";
var authenticationKeys = {};
var wsusername = [];

// Template engine
app.engine("html", function(fp, o, callback){
  fs.readFile(fp, function(err, c){
    if (err) return callback(new Error(err));
    var rendered = replaceAll(c.toString(), "%username%", o.username);
    rendered = replaceAll(rendered, "%wsauthkey%", o.key);
    /*var rows = c.toString().split("\n").forEach(function(v,i){
      rendered = rendered+"\n"+v.replaceAll("<?username?>", o.username);
    });*/
    return callback(null, rendered);
  });
});

// Enable special things with express
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.set('views', './views');
app.set('view engine', "html");
app.use(session({
  secret: "asdfasdf",
  resave: true,
  saveUninitialized: true,
  unset: "destroy",
  store: new MongoStore({ url: mongopath }),
  cookie: {maxAge: 600000, httpOnly: false}
}));
app.disable("x-powered-by");
app.enable("trust proxy");

// Static cache
app.use("/static", express.static("static"));

// Generic Functions
function grs(length) {
  var s = "";
  for (var i = 0; i <= length; i++) {
    s = s+casual.letter;
  }
  return s;
}
function addAuthKey(username) {
  var authKey = grs(100);
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

// TODO: Remove Debug stuff
app.get("/t", function(req,res){
  addAuthKey("asdf");
  res.send("asdf");
});
app.get("/reg", function(req, res){
  db.collection('users').insertOne({username: "joarc", password: "asdfasdf"});
  res.send("adding joarc:asdfasdf");
});

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
  req.session.destroy();
  res.redirect("/login");
});

app.get("/login", function(req, res){
  res.render("login", {});
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
        req.session.data = {username: o.username, key: req.session.id};
        wsusername[o.username] = req.session.id;
        res.send({success: true, key: req.session.id});
      } else {
        req.session.authenticated = false;
        req.session.data = {};
        res.send({success: false});
      }
    }
  }));
});

app.get("/", function(req, res){
  console.log(req.session.id);
  if (req.session.authenticated !== undefined) {
    if (req.session.authenticated) {
      res.render("index_loggedin", {username: req.session.data.username, key: req.session.data.key});
    } else {
      res.render("index_notloggedin", {});
    }
  } else {
    res.render("index_notloggedin", {});
  }
});

app.get("/data", function(req, res){
  if (req.session.authenticated) {
    res.send({username:req.session.data.username});
  } else {
    res.send({type:"error", msg:"not-authenticated"});
  }
});

app.use(function(req, res, next){
  res.status(404).render("404");
});

// Websocket Server
var server = ws.createServer(function(conn){
  /*var util = require("util");
  fs.writeFileSync('./data2', util.inspect(conn), "utf-8");*/
  conn.authenticated = false;
  conn.username = null;
  conn.on("text", function(str){
    str = JSON.parse(str);
    console.log(str);
    if (str.type == "authenticate") {
      if (conn.authenticated == false) {
        if (wsusername[str.msg.username] == str.msg.key) {
          conn.authenticated = true;
          conn.username = str.msg.username;
          conn.send(JSON.stringify({type: "alert", alert: {type:"info", msg:"Successful login"}}));
          //wsusername[str.msg.username] = conn.key;
        } else {
          conn.send(JSON.stringify({type: "alert", alert: {type:"danger", msg:"Error: Invalid AuthKey"}}));
          //conn.send(JSON.stringify({type: "refresh", refresh:true}));
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
    // Do something?
  });
});

// Start listening
app.listen(8080, function (){
  console.log('Express Server started on port 8080');
});
server.listen(8081, function(){
  console.log("WebSocket Server started on port 8081");
});
