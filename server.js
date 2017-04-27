/*
 * Serves the main Class Transcribe website on CT_PORT
 */

/* global variables */

express = require('express');
Mustache = require('mustache');
fs = require('fs');
path = require('path');
mime = require('mime');
passport = require('passport');
router = express.Router();

client = require('./modules/redis');
mailer = require('./modules/mailer');

/* end global variables */


var webvtt = require('./modules/webvtt');
var validator = require('./modules/validator');

var http = require('http');
var zlib = require('zlib');
var spawn = require('child_process').spawn;
var mkdirp = require('mkdirp');
var bodyParser = require('body-parser');

var cookieParser = require('cookie-parser');
var session = require('express-session');
passport = require('passport');
var saml = require('passport-saml');
var dotenv = require('dotenv');
var https = require('https');

dotenv.load();
piwik_port = process.env.PIWIK_PORT;

if (process.env.DEV == "DEV") {
    console.log("~~~~~~~~~~~");
    console.log("~DEVELOPER~");
    console.log("~~~~~~~~~~~");
}


require("./authentication");
require("./public/functions");

var app = express();

app.use(bodyParser.json());         // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));
app.use(express.static('public'));
app.use(cookieParser());
app.use(session({
  secret: "secret",
  resave: true,
  saveUninitialized: true 
}));
app.use(passport.initialize());
app.use(passport.session());

app.set('view engine', 'ejs');

/* I wasn't sure where to put these variables (that are used in various files */
mustachePath = 'templates/';

exampleTerms = {
  "cs241": "printf",
  "cs225": "pointer",
  "cs225-sp16": "pointer",
  "chem233-sp16": 'spectroscopy',
  "adv582": "focus group",
  "ece210": "Energy Signals",
  "cs446-fa16": "Decision Trees"
}


captionsMapping = {

  "cs241": require('./public/javascripts/data/captions/cs241.js'),
  "cs225": require('./public/javascripts/data/captions/cs225.js'),
  "cs225-sp16": require('./public/javascripts/data/captions/cs225-sp16.js'),
  "chem233-sp16": require('./public/javascripts/data/captions/chem233-sp16.js'),
  "adv582": require('./public/javascripts/data/captions/adv582.js'),
  "ece210": require('./public/javascripts/data/captions/ece210.js'),
  "cs446-fa16": require('./public/javascripts/data/captions/cs446-fa16.js'),
}


//===========================my section=========================================

//=======================Sample data for testing=====================================
function getClassUid(university="", term="", number="", section="") {
    if(!university|| !term|| !number|| !section){
        console.log("potential problem in uid, empty/null value detected");
    }
    return university+"-"+term+"-"+number+"-"+section;
}

var schoolTermsList = ["Spring 2016", "Fall 2016","Spring 2017", "Fall 2017", "Spring 2018", "All"];
// 0-subject, 1-class number, 2-Section-number, 3-class name, 4-class description, 5-University, 6-instructor name
var courseList = {"Spring 2016":[["Computer Science", "CS123","AGX","Intro to CS", "no desc yet", "UIUC","Instructor A. P."],
    ["Computer Science", "CS223","GAX","More intro to CS", "desc", "UIUC","Instructor B. P."],
    ["History", "HIST123","AGX","Intro to Ancient Civ", "desc", "UIUC","Instructor H. P."]],
    "Fall 2016":[["Mathematics", "MATH343","XGX","Linear Algebra", "desc", "UIUC","Instructor B. E."],
        ["Computer Science", "CS423","GHX","Even More intro to CS", "desc", "UIUC","Instructor W. J."],
        ["Sociology", "SOCI323","AGX","Society and XXX", "desc", "UIUC","Instructor Q"]],
    "Spring 2017":[], "Fall 2017":[], "Spring 2018":[],"All":[]};


schoolTermsList.forEach( function ( t) {
    client.sadd("ClassTranscribe::Terms", "ClassTranscribe::Terms::"+t);
    courseList[t].forEach(function (course) {
        // Add  course
        //console.log(course);
        var classid=getClassUid(university=course[5], term=t, number=course[1], section=course[2]);

        //General Information update
        client.sadd("ClassTranscribe::CourseList", "ClassTranscribe::Course::"+classid); // add class to class list
        client.sadd("ClassTranscribe::Terms::"+t, "ClassTranscribe::Course::"+classid); // add class to term list
        client.sadd("ClassTranscribe::SubjectList", "ClassTranscribe::Subject::"+course[0]); // add class subject to subject list
        client.sadd("ClassTranscribe::Subject::"+course[0], "ClassTranscribe::Course::"+classid); // add class to the subject


        // Add Course Info
        client.hset("ClassTranscribe::Course::"+classid, "Subject", course[0]);
        client.hset("ClassTranscribe::Course::"+classid, "ClassNumber", course[1]);
        client.hset("ClassTranscribe::Course::"+classid, "SectionNumber", course[2]);
        client.hset("ClassTranscribe::Course::"+classid, "ClassName", course[3]);
        client.hset("ClassTranscribe::Course::"+classid, "ClassDesc", course[4]);
        client.hset("ClassTranscribe::Course::"+classid, "University", course[5]);
        client.hset("ClassTranscribe::Course::"+classid, "Instructor", course[6]);
    });
});


console.log("Sample Data Loaded");
//======================End of sample data==========================================================
//----------------Management Page Section-------------------------------------------
var allterms = [];
var managementMustache = fs.readFileSync(mustachePath + 'management.mustache').toString();
app.get('/manage-classes', function (request, response) {
    response.writeHead(200, {
        'Content-Type': 'text/html'
    });
    // get all terms data from the database
    client.smembers("ClassTranscribe::Terms", function(err, reply) {
        // reply is null when the key is missing
        allterms=[];
        reply.forEach(function (e) {
            allterms.push(e.split("::")[2]);
        })
        console.log("terms initted");
        console.log(allterms);
        var view = {
            termlist: allterms,
        };
        var html = Mustache.render(managementMustache, view);
        response.end(html);
    });
});

// TODO: Security check, and university info should come from session not submitted
// Add new class
app.post('/manage-classes/newclass', function (request, response) {
    console.log("new class to be added, start processing...");
    var term = "ClassTranscribe::Terms::"+request.body.Term;
    var classid = getClassUid(university=request.body["University"], term=request.body["Term"], number=request.body["University"], section=request.body["SectionNumber"]);
    var course = request.body;
    // add class
    client.sadd("ClassTranscribe::CourseList", "ClassTranscribe::Course::"+classid); // add class to class list
    client.sadd(term, "ClassTranscribe::Course::"+classid); // add class to term list
    client.sadd("ClassTranscribe::SubjectList", "ClassTranscribe::Subject::"+course["Subject"]); // add class subject to subject list
    client.sadd("ClassTranscribe::Subject::"+course["Subject"], "ClassTranscribe::Course::"+classid); // add class to the subject


    // Add Course Info
    client.hset("ClassTranscribe::Course::"+classid, "Subject", course["Subject"]);
    client.hset("ClassTranscribe::Course::"+classid, "ClassNumber", course["ClassNumber"]);
    client.hset("ClassTranscribe::Course::"+classid, "SectionNumber", course["SectionNumber"]);
    client.hset("ClassTranscribe::Course::"+classid, "ClassName", course["ClassName"]);
    client.hset("ClassTranscribe::Course::"+classid, "ClassDesc", course["ClassDescription"]);
    client.hset("ClassTranscribe::Course::"+classid, "University", course["University"]);
    client.hset("ClassTranscribe::Course::"+classid, "Instructor", course["Instructor"]);
    response.end();
//    console.log(request.body);
});

// return courses and their information offered in a term
app.get('/manage-classes/getterminfo', function (request, response) {
    console.log("term change noted");
    console.log(request.query["term"]);
    if(request.query["term"]=="All"){
        var term = "ClassTranscribe::CourseList";
    }
    else {
        var term = "ClassTranscribe::Terms::" + request.query["term"];
    }
    client.smembers(term, function (err, reply) {
        var commands = [];
        reply.forEach(function (c){
            // query every class to get info for display
            commands.push(["hgetall", c]);
        });
        console.log("getterminfo command:"+commands);
        client.multi(commands).exec(function (err, replies) {
            console.log("getterminfo final replies:"+replies);
            response.send(replies);
        });
    });
});

//----------------Management Section-------------------------------------------
//====================================================================

/*
    Uncomment this and visit this route to create and show the Metadata
    needed for registering with a Shibboleth Identity Provider


app.get('/Metadata',
  function (req, res) {
    res.type('application/xml');
    res.status(200).send(samlStrategy.generateServiceProviderMetadata(fs.readFileSync("./cert/cert/cert.pem", "utf8")));
  }
);
*/

var thirtyMinsInMilliSecs = 30 * 60 * 1000;

setInterval(clearInactiveTranscriptions, thirtyMinsInMilliSecs);

require('./router')(app);

var port = process.env.CT_PORT || 8000;

var options = {
  key: fs.readFileSync("./cert/cert/key.pem"),
  cert: fs.readFileSync("./cert/cert/cert.pem")
};


var httpsServer = https.createServer(options, app);
httpsServer.listen(port, function() {
	console.log("Class Transcribe on: " + port);
});



