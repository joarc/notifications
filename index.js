/*
 * Notifications (N!) Software
 * Creator: Joarc (Joar Classon)
 * Copyright Joar Classon
 */
// Load required libraries
var express = require("express");
var session = require("express-session");
var bodyParser = require('body-parser');

// Start express
var app = express();

// Enable body-parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// Static cache
app.use("/static", express.static("static"));

// Settings
//app.use(express.json());
app.use(session({secret: "asdfasdf", resave: true, saveUninitialized: false, cookie: {maxAge: 60000}}));
app.disable("x-powered-by");
app.enable("trust proxy");
app.locals.title = "notfications";
app.locals.email = "joarc@joarc.se";

// Router
/*app.get('/', function (req, res) {
  res.sendFile("index.html", {root: __dirname + "/public/"});
});*/

app.get("/login", function(req, res){
  res.sendFile("login.html", {root: __dirname + "/public/"});
});
app.post("/login", function(req, res, next){
  var login = {username: req.body.username, password: req.body.password};
  console.log(login);
  next();
}, function(req, res){
  req.session.loggedin = true;
  res.send("Success");
});


app.get("/", function(req, res){
  if (req.session.loggedin !== undefined) {
    res.send("Logged in: ");
    console.log(req.session.loggedin);
    if (req.session.loggedin) {
      res.send("true");
    } else {
      res.send("false");
    }
  } else {
    res.send("Logged in: false");
  }
});

app.listen(3000, function () {
  console.log('Notifications (N!) is started on port 3000');
});
