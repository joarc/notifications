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

// Start express
var app = express();

// Enable body-parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// Static cache
app.use("/static", express.static("static"));

// Settings
//app.use(express.json());
app.use(session({secret: "asdfasdf", resave: true, saveUninitialized: false, cookie: {maxAge: 600000}}));
app.disable("x-powered-by");
app.enable("trust proxy");
app.locals.title = "notfications";
app.locals.email = "joarc@joarc.se";

// var
var path = pathlib.join(__dirname+"/public/");
var loggedInUsers = [];
var notificationsToUsers = [];

// Generic Functions
function grs(length) {
  var s = "";
  for (var i = 0; i <= length; i++) {
    s = s+casual.letter;
  }
  return s;
}

// Router
/*app.get('/', function (req, res) {
  res.sendFile("index.html", {root: __dirname + "/public/"});
});*/

app.get("/logout", function(req, res){
  req.session.loggedin = false;
  req.session.logindata = {};
  req.session.wskey = "";
  res.redirect("/");
})

app.get("/login", function(req, res){
  res.sendFile(path+"login.html");
});
app.post("/login", function(req, res){
  console.log(req.body);
  var login = {username: req.body.username, password: req.body.password, key: grs(100)};
  if (login.username != "joarc" && login.password != "asdfasdf") return;
  req.session.logindata = login;
  loggedInUsers[login.username] = login;
  console.log(login);
  req.session.loggedin = true;
  notificationsToUsers[req.body.username] = {type: "success", msg: "Login Successfull"};
  //console.log(req);
  res.redirect("/");
});

app.get("/", function(req, res){
  if (req.session.loggedin !== undefined) {
    if (req.session.loggedin) {
      res.sendFile(path+"index_loggedin.html");
    } else {
      res.sendFile(path+"index_notloggedin.html");
    }
  } else {
    res.sendFile(path+"index_notloggedin.html");
  }
});

app.get("/data", function(req, res){
  if (req.session.loggedin) {
    var data = {username: req.session.logindata.username, key: req.session.logindata.key};
    res.send(data);
  } else {
    var error = {type: "error", msg: "you are not logged in!"};
    res.send(error);
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
      if (loggedInUsers[str.msg.username] != null) {
        if (loggedInUsers[str.msg.username].key == str.msg.key) {
          conn.authenticated = true;
          conn.userdata = loggedInUsers[str.msg.username];
        }
      }
    } else {
      var alertId = casual.integer(1,99999999);
      if (conn.authenticated == true) {
        if (str.type == "debug_alert") {
          if (str.msg != "") {
            conn.send(JSON.stringify({type: "alert", alert: {type:str.msg,msg:"Debug Alert",id:alertId}}));
          } else {
            conn.send(JSON.stringify({type: "alert", alert: {type:"info",msg:"Debug Alert",id:alertId}}));
          }
        }
      } else {
        conn.send(JSON.stringify({type: "alert", alert: {type:"danger",msg:"Error: Not Authenticated!",id:alertId}}));
      }    }
  });
  conn.on("close", function(code, reason){
    console.log("Connection closed");
    conn.username = null;
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
