/** Copyright 2015 Board of Trustees of University of Illinois
 * All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var cp = require('child_process');

class SearchHelper{
    constructor(term){
        this.output = "";
        this.child = null;
        this.term = term;

    }

    _start(cb){
        // debug info, feel free to delete this
        var parentDir = path.resolve(process.cwd());
        console.log("searching term: "+parentDir);
        console.log("searching term: "+this.term);

        this.child = cp.spawn('python',["testnodepy.py",this.term],{cwd:".\\utility_scripts"});
        var helper = this;
        if(typeof cb == "function"){
            console.log("cb IS a function");
        }
        this.child.stdout.on('data',function(data){
            //var textChunk = chunk.toString('utf8');// buffer to string
            //console.log(textChunk);
            //this.output+=textChunk;
            helper.output+=data;
        });

        this.child.stderr.on('data',function(data){
            console.log(data.toString('utf8'));
            //console.log(data.toString('utf8'));
            //helper.output+=data;
        });
        // this.child.on("close",function () {
        //     console.log(helper.output)
        //     cb(helper.output);
        // });
        this.child.on("exit",function () {
            cb(helper.output);
        });
    }



    _callback(){


    }



}


module.exports.SearchHelper = SearchHelper;


//process.stdout.write(output);




