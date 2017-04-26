var http = require('http');
var express = require('express');
var Mustache = require('mustache');
var fs = require('fs');
var zlib = require('zlib');
var path = require('path');
var mime = require('mime');
var webvtt = require('./modules/webvtt');

//var redis = require('redis');
var client = require('./modules/redis');
//var client = redis.createClient(6379, "localhost");



var mailer = require('./modules/mailer');
var validator = require('./modules/validator');
var spawn = require('child_process').spawn;
var mkdirp = require('mkdirp');
var bodyParser = require('body-parser')

var app = express();

app.use(bodyParser.json());         // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 
app.use(express.static('public'));


//----------------------redis testing-------------------
// client.set("tkey", "tval");
// client.set("tkey2", "tval2");
// console.log(client.keys("*"));
// client.get("tkey", function (err, reply) {
//     console.log(reply.toString()); // Will print `OK`
// });
// function redis_probe_keys() {
//     client.keys("*", function (err, reply) {
//         console.log(JSON.stringify(reply));
//         console.log(reply.toString()); // Will print `OK`
//     });
// }
// redis_probe_keys();
// client.get("missingkey", function(err, reply) {
//     // reply is null when the key is missing
//     console.log(reply);
// });
// console.log("-----end of redis probing----");
//----------------------end of redis testing-------------------

//=======================Sample data for testing=====================================
function getClassUid(university="", term="", number="", section="") {
  if(!university|| !term|| !number|| !section){
    console.log("potential problem in uid, empty/null value detected");
  }
  return university+"-"+term+"-"+number+"-"+section;
}
// // test cases
// console.log("uid-test-1");
// console.log(getClassUid());
// console.log("uid-test-2");
// console.log(getClassUid("23",34,54,23));
// console.log("uid-test-3");
// console.log(getClassUid(12,"a3",65));
// console.log("uid-test-4");
// console.log(getClassUid(12,null,65,"23"));



// old sequential unique id
client.get("ucid", function (err, reply) {
   if(reply==null)
       client.set("ucid", 100);
});
var schoolTermsList = ["Spring 2016", "Fall 2016","Spring 2017", "Fall 2017", "Spring 2018"];
// 0-subject, 1-class number, 2-class name, 3-instructor name, 4-unique class id, 5-class description
var courseList = {"Spring 2016":[["CS123",123,"Class name A","Instructor A", 1],
    ["CS223",223,"Class name B","Instructor A", 2],
    ["CS323",323,"Class name C","Instructor C",3]],
    "Fall 2016":[["CS123",167,"Class name 167","Instructor C",4],
        ["CS545",545,"Class name 545","Instructor J",5],
        ["CS523",523,"Class name 523","Instructor Q",6]],
    "Spring 2017":[], "Fall 2017":[], "Spring 2018":[]};
schoolTermsList.forEach( function ( e) {
    client.sadd("ClassTranscribe::Terms", "ClassTranscribe::Terms::"+e);
    courseList[e].forEach(function (course) {
      // Add  course
        //console.log(course);
        var classid=course[4];
       client.sadd("ClassTranscribe::Terms::"+e, "ClassTranscribe::Terms::"+e+"::"+classid);
       // Add Course Info
        client.hset("ClassTranscribe::Terms::"+e+"::"+classid, "ClassNumber", course[0]);
        client.hset("ClassTranscribe::Terms::"+e+"::"+classid, "ClassName", course[2]);
        client.hset("ClassTranscribe::Terms::"+e+"::"+classid, "Instructor", course[3]);
        client.hset("ClassTranscribe::Terms::"+e+"::"+classid, "ClassDesc", "To be added");
    });
});


//--------testing--------------------
client.hgetall("ClassTranscribe::Terms::Fall 2016::4", function (err, reply){
    console.log(typeof (reply));
    console.log(reply);
});

client.smembers("ClassTranscribe::Terms", function (err, reply){
    console.log(typeof (reply));
    console.log(reply);
});

console.log("Sample Data Loaded");
//======================End of sample data==========================================================








var mustachePath = 'templates/';

var exampleTerms = {
  "cs241": "printf",
  "cs225": "pointer",
  "cs225-sp16": "pointer",
  "chem233-sp16": 'spectroscopy',
  "adv582": "focus group",
  "ece210": "Energy Signals",
  "cs446-fa16": "Decision Trees"
}


var homeMustache = fs.readFileSync(mustachePath + 'home.mustache').toString();
app.get('/', function (request, response) {
  response.writeHead(200, {
    'Content-Type': 'text/html'
  });

  var html = Mustache.render(homeMustache);
  response.end(html);
});

//----------------Management Page Section-------------------------------------------
//var allterms="variable not properly init";
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


// Add new class
app.post('/manage-classes/newclass', function (request, response) {
    //response.render(servervar1: testvar1);
    //response.send(testvar1);
    console.log("new class added");
    var term = "ClassTranscribe::Terms::"+request.body.Term;
    client.get("ucid", function (err, reply) {
        var ucid = reply;
        // update the next avaliable unique class id
        client.incr("ucid");
        var classkey = term+"::"+ucid;
        // add class
        client.hset(classkey, "ClassNumber", request.body["ClassNumber"]);
        client.hset(classkey, "ClassName", request.body["ClassName"]);
        client.hset(classkey, "Instructor", request.body["Instructor"]);
        client.hset(classkey, "ClassDesc", "To be added");
        client.sadd(term, classkey);
        response.end();
    });
//    console.log(request.body);
});


// app.post('/manage-classes/gettest', function (request, response) {
//     //response.render(servervar1: testvar1);
//     response.send(testvar1);
//     console.log("req noted");
//     console.log(request.body);
// });


//
// var testvar = ["tp1", "tp2"];
//
// app.get('/test/:testvar', function (request, response) {
//     var testvar = request.params.testvar.toLowerCase();
//     response.writeHead(200, {
//         'Content-Type': 'text/html'
//     });
//     var view = {
//         tvar:testvar,
//     };
//     console.log(testvar);
//     var html = Mustache.render(homeMustache,view);
//     response.end(html);
// });



// return courses and their information offered in a term
app.get('/manage-classes/getterminfo', function (request, response) {
    console.log("term change noted");
    console.log(request.query["term"]);
    var term = "ClassTranscribe::Terms::"+request.query["term"];
    client.smembers(term, function (err, reply) {
        var commands = [];
        reply.forEach(function (c){
          // query every class to get info for display
            commands.push(["hgetall", c]);
        });
        console.log("getterminfo command:"+commands);
        client.multi(commands).exec(function (err, replies) {
            response.send(replies);
        });
    });
});

//----------------Management Section-------------------------------------------









var viewerMustache = fs.readFileSync(mustachePath + 'viewer.mustache').toString();
app.get('/viewer/:className', function (request, response) {
  var className = request.params.className.toLowerCase();

  response.writeHead(200, {
    'Content-Type': 'text/html',
    "Access-Control-Allow-Origin" : "*",
    "Access-Control-Allow-Methods" : "POST, GET, PUT, DELETE, OPTIONS"
  });

  var view = {
    className: className,
  };
  var html = Mustache.render(viewerMustache, view);
  response.end(html);
});

var searchMustache = fs.readFileSync(mustachePath + 'search.mustache').toString();
app.get('/:className', function (request, response) {
  var className = request.params.className.toLowerCase();

  response.writeHead(200, {
    'Content-Type': 'text/html'
  });

  var view = {
    className: className,
    exampleTerm: exampleTerms[className]
  };
  var html = Mustache.render(searchMustache, view);
  response.end(html);
});

var progressDashboardMustache = fs.readFileSync(mustachePath + 'progressDashboard.mustache').toString();
app.get('/viewProgress/:className/:uuid', function (request, response) {
  var className = request.params.className;
  var uuid = request.params.uuid;

  var isMemberArgs = ['ClassTranscribe::AllowedUploaders', uuid]
  client.sismember(isMemberArgs, function (err, result) {
    if (result) {
      progressDict = {}
      client.smembers("ClassTranscribe::First::" + className, function (err, firstMembers) {
        if (err) {
          console.log(err);
        }

        client.smembers("ClassTranscribe::Finished::" + className, function (err, finishedMembers) {
          if (err) {
            console.log(err);
          }

          firstMembers.forEach(function (member) {
            var netID = member.split("-")[1].replace(".json", "").replace(".txt", "");
            if (progressDict.hasOwnProperty(netID)) {
              progressDict[netID] = progressDict[netID] + 1;
            } else {
              progressDict[netID] = 1;
            }
          });

          finishedMembers.forEach(function (member) {
            var netID = member.split("-")[1].replace(".json", "").replace(".txt", "");
            if (progressDict.hasOwnProperty(netID)) {
              progressDict[netID] = progressDict[netID] + 1;
            } else {
              progressDict[netID] = 1;
            }
          });

          var studentProgress = []
          for (netID in progressDict) {
            if (progressDict.hasOwnProperty(netID) && netID !== 'omelvin2') {
              studentProgress.push({'netID': netID, 'count': progressDict[netID]});
            }
          }

          response.writeHead(200, {
            'Content-Type': 'text/html'
          });

          var view = {
            className: className,
            studentProgress: studentProgress
          };
          var html = Mustache.render(progressDashboardMustache, view);
          response.end(html);
        });
      });
    }
  })
});

app.post('/download', function(request, response) {
  var transcriptions = JSON.parse(request.body.transcriptions);
  var fileNumber = Math.round(Math.random() * 10000)
  fs.writeFileSync("public/Downloads/" + fileNumber + ".webvtt", webvtt(transcriptions));
  response.writeHead(200, {
    'Content-Type': 'application/json'
  });
  response.end(JSON.stringify({fileNumber: fileNumber}));
});

app.get('/download/webvtt/:fileNumber', function (request, reponse) {
  var file = "public/Downloads/" + request.params.fileNumber + ".webvtt";

  var filename = path.basename(file);
  var mimetype = mime.lookup(file);

  reponse.setHeader('Content-disposition', 'attachment; filename=' + filename);
  reponse.setHeader('Content-type', mimetype);

  var filestream = fs.createReadStream(file);
  filestream.pipe(reponse);
});

var firstPassMustache = fs.readFileSync(mustachePath + 'index.mustache').toString();
app.get('/first/:className/:id', function (request, response) {
  var className = request.params.className.toUpperCase();
  response.writeHead(200, {
    'Content-Type': 'text/html',
    "Access-Control-Allow-Origin" : "*",
    "Access-Control-Allow-Methods" : "POST, GET, PUT, DELETE, OPTIONS"
  });

  var view = {
    className: className,
    taskName: request.query.task,
  };
  var html = Mustache.render(firstPassMustache, view);
  response.end(html);
});

app.get('/Video/:fileName', function (request, response) {
  var file = path.resolve(__dirname + "/Video/", request.params.fileName + ".mp4");
  var range = request.headers.range;
  var positions = range.replace(/bytes=/, "").split("-");
  var start = parseInt(positions[0], 10);

  fs.stat(file, function(err, stats) {
    var total = stats.size;
    var end = positions[1] ? parseInt(positions[1], 10) : total - 1;
    var chunksize = (end - start) + 1;

    response.writeHead(206, {
      "Content-Range": "bytes " + start + "-" + end + "/" + total,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "video/mp4"
    });

    var stream = fs.createReadStream(file, { start: start, end: end })
      .on("open", function() {
        stream.pipe(response);
      }).on("error", function(err) {
        response.end(err);
      });
  });
})

app.post('/first', function (request, response) {
  var stats = JSON.parse(request.body.stats);
  var transcriptions = request.body.transcriptions;//
  var className = request.body.className.toUpperCase();//
  var statsFileName = stats.video.replace(/\ /g,"_") + "-" + stats.name + ".json";
  var captionFileName = stats.video.replace(/\ /g,"_") + "-" + stats.name + ".txt";
  var taskName = stats.video.replace(/\ /g,"_");
  mkdirp("captions/first/" + className, function (err) {
    if (err) {
      console.log(err);
    }
    transcriptionPath = "captions/first/" + className + "/" + captionFileName;
    client.sadd("ClassTranscribe::Transcriptions::" + transcriptionPath, transcriptions);
    fs.writeFileSync(transcriptionPath, transcriptions, {mode: 0777});
  });

  mkdirp("stats/first/" + className, function (err) {
    if (err) {
      console.log(err);
    }
    statsPath = "stats/first/" + className + "/" + statsFileName;
    client.sadd("ClassTranscribe::Stats::" + statsPath, request.body.stats);
    fs.writeFileSync(statsPath, request.body.stats, {mode: 0777});


    var isTranscriptionValid = validator.validateTranscription("stats/first/" + className + "/" + statsFileName)

    if (isTranscriptionValid) {
      console.log("Transcription is good!");
      client.zincrby("ClassTranscribe::Submitted::" + className, 1, taskName);
      client.zscore("ClassTranscribe::Submitted::" + className, taskName, function(err, score) {
        score = parseInt(score, 10);
        if (err) {
          return err;
        }

        if (score === 10) {
          client.zrem("ClassTranscribe::Submitted::" + className, taskName);
          client.zrem("ClassTranscribe::PrioritizedTasks::" + className, taskName);
        }

        client.sadd("ClassTranscribe::First::" + className, captionFileName);
        var netIDTaskTuple = stats.name + ":" + taskName;
        console.log('tuple delete: ' + netIDTaskTuple);
        client.hdel("ClassTranscribe::ActiveTranscribers::" + className, netIDTaskTuple);
        sendProgressEmail(className, stats.name);
      });
    } else {
      console.log("Transcription is bad!");
      client.lpush("ClassTranscribe::Failed::" + className, captionFileName);
      return;
    }
  });
});

var secondPassMustache = fs.readFileSync(mustachePath + 'editor.mustache').toString();
app.get('/second/:className/:id', function (request, response) {
  var className = request.params.className.toUpperCase();
  response.writeHead(200, {
    'Content-Type': 'text/html',
    "Access-Control-Allow-Origin" : "*",
    "Access-Control-Allow-Methods" : "POST, GET, PUT, DELETE, OPTIONS"
  });

  var view = {
    className: className,
    taskName: request.query.task,
  };
  var html = Mustache.render(secondPassMustache, view);
  response.end(html);
});

var queueMustache = fs.readFileSync(mustachePath + 'queue.mustache').toString();
app.get('/queue/:className', function (request, response) {
  var className = request.params.className.toUpperCase();

  var view = {
    className: className
  };

  var html = Mustache.render(queueMustache, view);
  response.end(html);
});

app.get('/queue/:className/:netId', function (request, response) {
  var className = request.params.className.toUpperCase();
  var netId = request.params.netId.toLowerCase();
  
  var args = ["ClassTranscribe::Tasks::" + className, "0", "99999", "LIMIT", "0", "1"];
  client.zrangebyscore(args, function (err, result) {
    if (err) {
      throw err;
    }

    if (!result.length) {
      return response.end("No more tasks at the moment. More tasks are being uploaded as you read this. Please check back later.");
    }

    var taskName = result[0];
    // var fileName = chosenTask + "-" + netId + ".txt";

    args = ["ClassTranscribe::Tasks::" + className, "1", result[0]];
    client.zincrby(args);

    response.end(taskName);
  });
});

function highDensityQueue(response, className, netId, attemptNum) {
  var args = ["ClassTranscribe::Tasks::" + className, "0", "99999", "WITHSCORES", "LIMIT", "0", "1"];
  client.zrangebyscore(args, function (err, result) {
    if (err) {
      throw err;
    }

    // Tasks will only be empty if there are no tasks left or they've moved to PrioritizedTasks
    if (!result.length) {
      var args = ["ClassTranscribe::PrioritizedTasks::" + className, "0", "99999",
        "WITHSCORES", "LIMIT", "0", "1"];
      client.zrangebyscore(args, function (err, result) {
        if (!result.length) {
          response.end("No more tasks at the moment. Please email classtranscribe@gmail.com.");
        } else {
          taskName = result[0];
          taskScore = parseInt(result[1], 10);

          queueResponse(response, "PrioritizedTasks", netId, className, taskName, attemptNum);
        }
      });
    } else {
      var taskName = result[0];
      var taskScore = parseInt(result[1], 10);

      if(taskScore >= 2) {
        initPrioritizedTask(response, className, attemptNum);
      } else {
        queueResponse(response, "Tasks", netId, className, taskName, attemptNum);
      }
    }
  });
}

function initPrioritizedTask(response, className, netId, attemptNum) {
  var numTasksToPrioritize = 10;
  // Can't call zcard if doesn't exist. Unable to be directly handled by err in zcard call
  // due to how the redis client works
  client.exists("ClassTranscribe::PrioritizedTasks::" + className, function (err, code) {
    if (err) {
      throw err;
    }

    if (code === 0) {
      moveToPrioritizedQueue(response, className, netId, 0, numTasksToPrioritize, attemptNum);
    } else {
      client.zcard("ClassTranscribe::PrioritizedTasks::" + className, function (err, numberTasks) {
        if (err) {
          throw err;
        }

        moveToPrioritizedQueue(response, className, netId, numberTasks, numTasksToPrioritize, attemptNum);
      });
    }
  });
}

function queueResponse(response, queueName, netId, className, chosenTask, attemptNum) {
  console.log(chosenTask);

  if (attemptNum === 10) {
    response.end('It looks like you have already completed the available tasks.\n' +
      'If you believe this is incorrect please contact classtranscribe@gmail.com')
    return;
  }

  var incrArgs = ["ClassTranscribe::" + queueName + "::" + className, "1", chosenTask];
  client.zincrby(incrArgs);

  var netIDTaskTuple = netId + ":" + chosenTask;
  console.log('tuple ' + netIDTaskTuple);
  var date = new Date();
  var dateString = date.getTime();
  var hsetArgs = ["ClassTranscribe::ActiveTranscribers::" + className, netIDTaskTuple, dateString];
  client.hset(hsetArgs);

  var fileName = chosenTask + "-" + netId + ".txt";
  var isMemberArgs = ["ClassTranscribe::First::" + className, fileName]
  client.sismember(isMemberArgs, function (err, result) {
    if (result) {
      highDensityQueue(response, className, netId, attemptNum + 1);
    } else {
      // If not in First it may be in Finished
      isMemberArgs = ["ClassTranscribe::Finished::" + className, fileName]
      client.sismember(isMemberArgs, function (err, result) {
          if (result) {
            highDensityQueue(response, className, netId, attemptNum + 1);
          } else {
            response.end(chosenTask);
          }
      });
    }
  });
}

/**
 *  This function moves tasks from the Tasks to PrioritizedTasks queue, if needed.
 *  Then returns a task to be completed
 *
 * @param  {int} Number of tasks already in set
 * @param  {int} Number tasks desired in set
 * @return {string} task to be completed
 */
function moveToPrioritizedQueue(response, className, netId, numberTasks, numTasksToPrioritize, attemptNum) {
  if (numberTasks < numTasksToPrioritize) {
      var numDifference = numTasksToPrioritize - numberTasks;
      var args = ["ClassTranscribe::Tasks::" + className, "0", "99999",
        "WITHSCORES", "LIMIT", "0", numDifference];
      client.zrangebyscore(args, function (err, tasks) {
        if (err) {
          throw err;
        }

        for(var i = 0; i < tasks.length; i += 2) {
          var taskName = tasks[i];
          var score = parseInt(tasks[i + 1], 10);
          client.zrem("ClassTranscribe::Tasks::" + className, taskName);
          client.zadd("ClassTranscribe::PrioritizedTasks::" + className, score, taskName);
        }
        getPrioritizedTask(response, className, netId, attemptNum);
      });
    } else {
      getPrioritizedTask(response, className, netId, attemptNum);
    }
}

function getPrioritizedTask(response, className, netId, attemptNum) {
  var args = ["ClassTranscribe::PrioritizedTasks::" + className, "0", "99999", "LIMIT", "0", "1"];
  client.zrangebyscore(args, function(err, tasks) {
    if (err) {
      throw err;
    }
    var task = tasks[0]
    console.log('tasks from priority ' + task);
    queueResponse(response, "PrioritizedTasks", netId, className, task, attemptNum);
  });
}

function clearInactiveTranscriptions() {
  var classesToClear = ["CS241-SP16", "CHEM233-SP16", "CS225-SP16"];
  var curDate = new Date();

  classesToClear.forEach(function (className) {
    client.hgetall("ClassTranscribe::ActiveTranscribers::" + className, function (err, result) {
      if (err) {
        console.log(err);
        return;
      }

      if (result !== null) {
        for(var i = 0; i < result.length; i += 2) {
          var netIDTaskTuple = result[i].split(":");
          var netId = netIDTaskTuple[0];
          var taskName = netIDTaskTuple[1];
          var startDate = new Date(result[i + 1]);

          var timeDiff = Math.abs(curDate.getTime() - startDate.getTime());
          var diffHours = Math.ceil(timeDiff / (1000 * 3600));

          if (diffHours >= 2) {
            client.hdel("ClassTranscribe::ActiveTranscribers::" + className, result[i]);
            // dont' know which queue task is currently in
            var taskArgs = ["ClassTranscribe::Tasks::" + className, taskName];
            client.zscore(taskArgs, function (err, result) {
              if (err) {
                throw err;
              } else if (result !== null) {
                client.zincrby("ClassTranscribe::Tasks::" + className, -1, taskName);
              }
            })

            var priorityArgs = ["ClassTranscribe::PrioritizedTasks::" + className, taskName];
            client.zscore(priorityArgs, function (err, result) {
              if (err) {
                throw err;
              } else if (result !== null) {
                client.zincrby("ClassTranscribe::Tasks::" + className, -1, taskName);
              }
            })
          }
        }
      }
    })
  });

}

var captionsMapping = {
  //"cs241": require('./public/javascripts/data/captions/cs241.js'),
  //"cs225": require('./public/javascripts/data/captions/cs225.js'),
  //"cs225-sp16": require('./public/javascripts/data/captions/cs225-sp16.js'),
  //"chem233-sp16": require('./public/javascripts/data/captions/chem233-sp16.js'),
  //"adv582": require('./public/javascripts/data/captions/adv582.js'),
  //"ece210": require('./public/javascripts/data/captions/ece210.js'),
  //"cs446-fa16": require('./public/javascripts/data/captions/cs446-fa16.js'),

  "cs241": require('./public/javascripts/data/captions/cs241.js'),
  "cs225": require('./public/javascripts/data/captions/cs225.js'),
  "cs225-sp16": require('./public/javascripts/data/captions/cs225-sp16.js'),
  "chem233-sp16": require('./public/javascripts/data/captions/chem233-sp16.js'),
  "adv582": require('./public/javascripts/data/captions/adv582.js'),
  "ece210": require('./public/javascripts/data/captions/ece210.js'),
  "cs446-fa16": require('./public/javascripts/data/captions/cs446-fa16.js'),
}

app.get('/captions/:className/:index', function (request, response) {
  var className = request.params.className.toLowerCase();
  var captions = captionsMapping[className];

  response.writeHead(200, {
    'Content-Type': 'application/json'
  });

  var index = parseInt(request.params.index);
  response.end(JSON.stringify({captions: captions[index]}));
});

var progressMustache = fs.readFileSync(mustachePath + 'progress.mustache').toString();
app.get('/progress/:className', function (request, response) {
  var className = request.params.className.toUpperCase();

  var view = {
    className: className,
  };
  var html = Mustache.render(progressMustache, view);

  response.end(html);
});

app.post('/progress/:className/:netId', function (request, response) {
  var className = request.params.className.toUpperCase();
  var netId = request.params.netId;
  sendProgressEmail(className, netId, function () {
    response.end('success');
  });
});

function sendProgressEmail(className, netId, callback) {
  client.smembers("ClassTranscribe::First::" + className, function (err, firstMembers) {
    if (err) {
      console.log(err);
    }

    client.smembers("ClassTranscribe::Finished::" + className, function (err, finishedMembers) {
    if (err) {
      console.log(err);
    }

      var count = 0;
      firstMembers.forEach(function (member) {
        var user = member.split("-")[1].replace(".json", "").replace(".txt", "");
        if (user === netId) {
          count++;
        }
      });

      finishedMembers.forEach(function (member) {
        var user = member.split("-")[1].replace(".json", "").replace(".txt", "");
        if (user === netId) {
          count++;
        }
      });

      mailer.progressEmail(netId, className, count);
      if (callback) {
        callback();
      }
    });
  });
}

var thirtyMinsInMilliSecs = 30 * 60 * 1000;
//setInterval(clearInactiveTranscriptions, thirtyMinsInMilliSecs);

client.on("monitor", function (time, args, raw_reply) {
    console.log(time + ": " + args); // 1458910076.446514:['set', 'foo', 'bar']
});

client.on('error', function (error) {
	console.log('redis error'+error);
});

var port = 80;
app.listen(port, function () {
  console.log('listening on port ' + port + '!');
});

//------------------------------------------