/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const {classes:Cc, interfaces: Ci, utils: Cu} = Components;

const EXPORTED_SYMBOLS = ["HomepageStudy"];

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Console.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
// TODO: Change this for a proper path.
const RAPPOR_PATH = `jar:file:///Users/arodriguez/src/shield/shield-study-rappor/dist/addon.xpi!/bootstrap.js/.././TelemetryRappor.jsm`;
const { TelemetryRappor } = Cu.import(RAPPOR_PATH, {});

const console = new ConsoleAPI({prefix: "shield-study-rappor"});

/**
 * Read the cohort and the true value from a file. {client, cohort, value}.
 * @param {string} file - path containing the true values.
 */
function readCSV(file) {
  // open an input stream from file
  var istream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
  istream.init(file, 0x01, 0444, 0);
  istream.QueryInterface(Ci.nsILineInputStream);
  // read lines into array
  var line = {}, lines = [], hasmore;
  do {
  hasmore = istream.readLine(line);
  lines.push(line.value); 
  } while(hasmore);

  istream.close();

  // do something with read data
  return lines;
}

/**
 * write in a CSV {client, cohort, bloom, prr, irr}.
 * @param data - object containing the client, cohort, bloom, prr and irr.
 */
function writeCSV(filename, data) {
  // case_reports.csv
  // file is nsIFile, data is a string
  var foStream = Cc["@mozilla.org/network/file-output-stream;1"].
  createInstance(Ci.nsIFileOutputStream);

  // use 0x02 | 0x10 to open file for appending.
  foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0); 
  // write, create, truncate
  // In a c file operation, we have no need to set file mode with or operation,
  // directly using "r" or "w" usually.

  // if you are sure there will never ever be any non-ascii text in data you can 
  // also call foStream.write(data, data.length) directly
  var converter = Cc["@mozilla.org/intl/converter-output-stream;1"].
  createInstance(Ci.nsIConverterOutputStream);
  converter.init(foStream, "UTF-8", 0, 0);
  converter.writeString(data);
  converter.close(); // this closes foStream
  return;
}


function ConvertToBin(num) {
  return parseInt(num, 16).toString(2);
}

var HomepageStudy = {
/**
 * Returns the value encoded by RAPPOR or null if the homepage can't be obtained.
 * @param {string} studyName - Name of the study.
 *
 * @returns the encoded value returned by RAPPOR or null if the eTLD+1 can't be obtained.
 */
  reportValue: function(studyName) {
    // iterate over each line of the file
    let data = readCSV("case_true_values.csv");
    let params = readCSV("case_params.csv");
    let k = params[1].split(",")[0];
    let h = params[1].split(",")[1];
    let m = params[1].split(",")[2];
    let p = params[1].split(",")[3];
    let q = params[1].split(",")[4];
    let f = params[1].split(",")[5];
    
    for (var i = 1; i < data.length; i++) {
      line = data[i].split(",");
      writeCSV(TelemetryRappor.createReport(/*client*/ line[0], studyName, /*eLTDHomepage*/ line[2], k, h, m, f, p, q, /*cohort*/ line[1]));
    }
  },
}

