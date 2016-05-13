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

// Path
var path = pathlib.join(__dirname+"/public/");

// Router
/*app.get('/', function (req, res) {
  res.sendFile("index.html", {root: __dirname + "/public/"});
});*/

app.get("/logout", function(req, res){
  req.session.loggedin = false;
  req.session.logindata = {};
  res.redirect("/");
})

app.get("/login", function(req, res){
  res.sendFile(path+"login.html");
});
app.post("/login", function(req, res, next){
  var login = {username: req.body.username, password: req.body.password};
  req.session.logindata = login;
  console.log(login);
  next();
}, function(req, res){
  req.session.loggedin = true;
  console.log(req.session.loggedin);
  req.session.alert = {type: "success", msg: "Login Successfull"};
  res.redirect("/");
  //res.send("Success<br>"+'<a href="/">Home</a>');
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
    var data = {username: req.session.logindata.username, alert:req.session.alert};
    req.session.alert = {type: "none", msg: ""};
    res.send(data);
  } else {
    var error = {type: "error", msg: "you are not logged in!"};
    res.send(error);
  }
});

});

app.listen(3000, function () {
  console.log('Notifications (N!) is started on port 3000');
});

// Websocket Server
var server = ws.createServer(function(conn){
  connection.username = null;
  conn.on("text", function(str){
    console.log(str);
    if (str.type == "authenticate") {
    } else if (str.type == "debug_alert") {
      conn.send({alert: {type:"info",msg:"Debug Alert"}})
    }
  });
  conn.on("close", function(code, reason){
    console.log("Connection closed");
    connection.username = null;
  })
})
