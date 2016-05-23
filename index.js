/*
 * Notifications (N!) Software
 * Creator: Joarc (Joar Classon)
 * Copyright Joar Classon
 */
// Express libs
var express = require("express");
var session = require("express-session");

// Parser libs
var bodyParser   = require('body-parser');
var cookieParser = require('cookie-parser');

// MongoDB libs
var MongoStore = require('connect-mongo')(session);
var Mongo = require('mongodb').Db;
var MongoServer = require('mongodb').Server;

// Misc libs
var ws = require("nodejs-websocket");
var casual = require("casual");
var fs = require("fs");
var cookie = require("cookie");
var password = require("bcrypt-nodejs");
var compression = require('compression');

// Start express
var app = express();

// var
var mongopath = "mongodb://localhost:27017/notifications";
var wsusername = [];
var secret = "asdfasdf";
var cookieName = "sessionIdent";

// Template engine content
var enginedata = {
  css:                fs.readFileSync("./views/blocks/css.html"),
  js:                 fs.readFileSync("./views/blocks/js.html"),
  meta:               fs.readFileSync("./views/blocks/meta.html"),
  navbar_notloggedin: fs.readFileSync("./views/blocks/navbar_notloggedin.html"),
  navbar_loggedin:    fs.readFileSync("./views/blocks/navbar_loggedin.html"),
  footer:             fs.readFileSync("./views/blocks/footer.html")
};

// MongoDB
var db = new Mongo("notifications", new MongoServer("localhost", 27017, {auto_reconnect: true}), {w: 1});
db.open(function(e, d){
  if (e) {
    console.log(e);
  } else {
    console.log("MongoDB: Connected to database notifications");
    // Load mongo session keys
    db.collection("keys").find({}).toArray().then(function(data){
      data.forEach(function(v,i){
        //console.log(i, v);
        wsusername[v.username] = v.key;
      });
    });
  }
});

// Template engine
app.engine("html", function(fp, o, callback){
  fs.readFile(fp, function(err, c){
    if (err) return callback(new Error(err));
    var rendered = c.toString();
        rendered = replaceAll(rendered, "%#css#%", enginedata.css);
        rendered = replaceAll(rendered, "%#js#%", enginedata.js);
        rendered = replaceAll(rendered, "%#meta#%", enginedata.meta);
        rendered = replaceAll(rendered, "%#footer#%", enginedata.footer);
        //console.log(o, "engine input");
        if (o.username != undefined && o.username != null) {
          // navbar
          if (wsusername[o.username] != null) {
            rendered = replaceAll(rendered, "%#navbar#%", enginedata.navbar_loggedin);
          } else {
            rendered = replaceAll(rendered, "%#navbar#%", enginedata.navbar_notloggedin);
          }
          // Database info
          db.collection("users").findOne({username: o.username}, {}, function(dbe,dbo){
            //console.log(dbo, dbe, "render engine");
            if (dbo != null) {
              // firstname
              if (dbo.firstname != null) {
                rendered = replaceAll(rendered, "%firstname%", dbo.firstname);
              } else {
                rendered = replaceAll(rendered, "%firstname%", "");
              }

              // lastname
              if (dbo.lastname != null) {
                rendered = replaceAll(rendered, "%lastname%", dbo.lastname);
              } else {
                rendered = replaceAll(rendered, "%lastname%", "");
              }

              // Switch username for firstname+lastname or firstname or username
              if (dbo.firstname != null && dbo.lastname != null) {
                rendered = replaceAll(rendered, "%name%", dbo.firstname+" "+dbo.lastname);
              } else if (dbo.firstname != null) {
                rendered = replaceAll(rendered, "%name%", dbo.firstname);
              } else {
                rendered = replaceAll(rendered, "%name%", dbo.username);
              }

              // username
              rendered = replaceAll(rendered, "%username%", o.username);
            } else {
              rendered = replaceAll(rendered, "%username%", o.username);
              rendered = replaceAll(rendered, "%firstname%", "");
              rendered = replaceAll(rendered, "%lastname%", "");
            }
            return callback(null, rendered);
          });
        } else {
          rendered = replaceAll(rendered, "%#navbar#%", enginedata.navbar_notloggedin);
          return callback(null, rendered);
        }
  });
});

// Enable special things with express
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(compression());
app.set('views', './views');
app.set('view engine', "html");
app.use(session({
  secret: secret,
  name: cookieName,
  resave: true,
  saveUninitialized: true,
  unset: "destroy",
  store: new MongoStore({ url: mongopath }),
  cookie: {maxAge: 600000, httpOnly: true}
}));
app.disable("x-powered-by");
app.enable("trust proxy");
app.use("/css", express.static("static/css"));
app.use("/js", express.static("static/js"));
app.use("/fonts", express.static("static/fonts"));

// Generic Functions
function grs(length) {
  var s = "";
  for (var i = 0; i <= length; i++) {
    s = s+casual.letter;
  }
  return s;
}
function checkPassword(pass, dbpass) {
  return password.compareSync(pass, dbpass);
}
function replaceAll(target, search, replacement) {
    return target.replace(new RegExp(search, 'g'), replacement);
}
function isInArray(value, array) {
  return array.indexOf(value) > -1;
}

// TODO: Remove Debug stuff
app.get("/t", function(req,res){
  db.collection("keys").remove({});
  res.send("emptied keys database");
});
app.get("/reg", function(req, res){
  db.collection('users').insertOne({username: "joarc", password: password.hashSync("asdfasdf")});
  res.send("adding joarc:asdfasdf");
});
app.get("/regd", function(req, res){
  db.collection("users").remove({});
  res.send("emptied users database");
})

// Login Process
app.get("/logout", function(req, res){
  req.session.destroy();
  res.redirect("/login#loggedout");
});

app.get("/register", function(req, res){
  if (req.session.authenticated) res.location("/");
  res.render("register", {});
});
app.post("/register",  function(req, res){
  if (req.session.authenticated) res.send({success: false, msg: "Already authenticated"});
  var data = req.body;
  data.username = data.username.toLowerCase();
  var userDB = db.collection("users");
  userDB.findOne({username:data.username}, {}, function(e,o){
    if (o == null) {
      if (data.password == data.confirmpassword) {
        userDB.insertOne({username: data.username, password: password.hashSync(data.password), firstname: "", lastname: "", company: ""})
        res.send({success: true});
      } else {
        res.send({success: false, msg: "Passwords do not match"});
      }
    } else {
      res.send({success: false, msg: "Username already taken"});
    }
  });
});

app.get("/login", function(req, res){
  if (req.session.authenticated) res.redirect("/dashboard");
  console.log("loaded get loginpage");
  console.log(req.session.authenticated);
  res.render("login", {});
});
app.post("/login", function(req, res){
  console.log("loaded post loginpage");
  if (req.session.authenticated) res.send({success: false, msg: "Already authenticated"});
  db.collection('users').findOne({username:req.body.username}, {}, function(e,o){
    if (o == null) {
      req.session.authenticated = false;
      req.session.data = {};
      res.send({success: false});
    } else {
      if (checkPassword(req.body.password, o.password)) {
        console.log("login success");
        req.session.authenticated = true;
        req.session.data = {username: o.username};
        wsusername[o.username] = req.session.id;
        db.collection("keys").update({username: o.username}, {username: o.username, key: req.session.id}, {upsert: true});
        res.send({success: true});
      } else {
        req.session.authenticated = false;
        req.session.data = {};
        res.send({success: false});
      }
    }
  });
});

// Profile
app.get("/profile", function(req, res){
  if (req.session.authenticated == true) {
    res.render("profile", {username: req.session.data.username});
  } else {
    res.location("/login#loggedout");
    res.end();
  }
});
app.post("/profile", function(req, res){
  if (req.session.authenticated == true) {
    var data = req.body;
    db.collection("users").findOne({username: req.session.data.username}, {}, function(e,o){
      if (o != null) {
        db.collection("users").updateOne({username: req.session.data.username}, {firstname: data.firstname, lastname: data.lastname, company: data.company, username: req.session.data.username, password: o.password}, null, function(e2,o2){
          /*console.log("inserted data");
          console.log(e2);
          console.log("inserted datao");
          console.log(o2);*/
        });
        res.render("profile", {username: req.session.data.username});
      } else {
        //console.log(e, o, "o is null");
        res.render("profile", {username: req.session.data.username});
      }
    });
  } else {

  }
});

// Dashboard
app.get("/dashboard", function(req, res){
  if (req.session.authenticated !== undefined) {
    if (req.session.authenticated) {
      res.render("dashboard", {username: req.session.data.username});
    } else {
      res.redirect("/login#notloggedin")
      res.end();
    }
  } else {
    res.redirect("/login#notloggedin");
    res.end();
  }
});

// About
app.get("/about", function(req, res){
  if (req.session.authenticated !== undefined) {
    if (req.session.authenticated) {
      res.render("about", {username: req.session.data.username});
    } else {
      res.render("about", {});
    }
  } else {
    res.render("about", {});
  }
});

// Pricing
app.get("/pricing", function(req, res){
  if (req.session.authenticated !== undefined) {
    if (req.session.authenticated) {
      res.render("pricing", {username: req.session.data.username});
    } else {
      res.render("pricing", {});
    }
  } else {
    res.render("pricing", {});
  }
});

// Home Page
app.get("/", function(req, res){
  if (req.session.authenticated !== undefined) {
    if (req.session.authenticated) {
      res.render("index", {username: req.session.data.username});
    } else {
      res.render("index", {});
    }
  } else {
    res.render("index", {});
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
        if (conn.headers.cookie) {
          var sid = cookieParser.signedCookie(cookie.parse(conn.headers.cookie)[cookieName], secret);
          console.log(sid, wsusername[str.msg.username], "sid");
          if (wsusername[str.msg.username] == sid) {
            conn.authenticated = true;
            conn.username = str.msg.username;
            conn.send(JSON.stringify({type: "alert", alert: {type:"info", msg:"Successful Login!"}}));
          } else {
            conn.send(JSON.stringify({type: "alert", alert: {type:"danger", msg:"Error: Invalid AuthKey"}}));
          }
        } else {
          conn.send(JSON.stringify({type: "alert", alert: {type:"danger", msg:"No cookies recceived! Please contact Site Admins!"}}));
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
        } else {
          conn.send(JSON.stringify({type: "alert", alert: {type:"warning",msg:"Invalid type!"}}));
        }
      } else {
        conn.send(JSON.stringify({type: "alert", alert: {type:"danger", msg:"Not Authenticated!"}}));
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
