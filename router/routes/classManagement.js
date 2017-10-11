var router = express.Router();
var shelper = require("../../utility_scripts/searchContent.js");
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
        // Add course
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

var searchMustache = fs.readFileSync(mustachePath + 'search.mustache').toString();
//======================End of sample data==========================================================
//----------------Management Page Section-------------------------------------------
var allterms = [];
var managementMustache = fs.readFileSync(mustachePath + 'management.mustache').toString();
router.get('/manage-classes', function (request, response) {
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
        if (request.isUnauthenticated()) {
            var form = "<section> <div class=\"row\"> <h3>Create a new course</h3> </div> <form id=\"creation-form\" method=\"POST\"> <div class=\"row\"> <div class=\"col-md-3\"> <label>Subject</label> <input type=\"text\" class=\"form-control\" id=\"fminput1\" placeholder=\"Example input\" value=\"CS\" name=\"Subject\"> <label>Course Number</label> <input type=\"text\" class=\"form-control\" id=\"fminput2\" placeholder=\"Another input\" name=\"ClassNumber\"> </div> <div class=\"col-md-3\"> <label>Class Name</label> <input type=\"text\" class=\"form-control\" id=\"fminput3\" placeholder=\"Example input\" name=\"ClassName\"> <label>Instructor</label> <input type=\"text\" class=\"form-control\" id=\"fminput4\" placeholder=\"Example input\" name=\"Instructor\"> </div> <div class=\"col-md-2\"> <label>Section Number</label> <input type=\"text\" class=\"form-control\" id=\"fminput5\" placeholder=\"Example input\" name=\"SectionNumber\"> <label>University</label> <input type=\"text\" class=\"form-control\" id=\"fminput6\" placeholder=\"Example input\" name=\"University\"> </div> </div> <div class=\"row\"> <div class=\"col-md-8\"> <label>Course Description</label> <input type=\"text\" class=\"form-control\" id=\"fminput7\" placeholder=\"Example input\" name=\"ClassDescription\"> </div> </div> <div class=\"row\"> <div class=\"col-md-3\"> <button type=\"submit\" class=\"btn btn-primary\" id=\"subbtn\">Create Class</button> </div> </div> </form> </section>";
        }
        else{
            var form = "";
        }
        var view = {
            termlist: allterms,
            className: "cs225-sp16",
            exampleTerm: exampleTerms["cs225-sp16"],
            createform:form
        };
        var html = Mustache.render(managementMustache, view);
        console.log("is authenticated = "+request.isAuthenticated());










        response.end(html);
    });
});

// TODO: Security check, and university info should come from session not submitted
// Add new class
router.post('/manage-classes/newclass', function (request, response) {
    console.log("new class to be added, start processing...");
    var classid = getClassUid(university=request.body["University"], term=request.body["Term"], number=request.body["University"], section=request.body["SectionNumber"]);
    var term = "ClassTranscribe::Terms::"+request.body.Term;
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


// handle search
router.get('/manage-classes/search/', function (request, response) {
    console.log("start processing search...");
    //var searchterm = "ClassTranscribe::Terms::"+request.query.Search;
    var searchterm = request.query.Search;
    console.log(searchterm);
    //generateSearch(searchterm);
    var sch = new shelper.SearchHelper(request.query.Search)
    sch._start(function (line) {
        console.log(line);
    })
    response.end();
});











// return courses and their information offered in a term
router.get('/manage-classes/getterminfo', function (request, response) {
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

module.exports = router;