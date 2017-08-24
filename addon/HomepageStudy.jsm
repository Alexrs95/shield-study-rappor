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

// TODO: Change this for a proper path.
const RAPPOR_PATH = `jar:file:///Users/arodriguez/src/shield/shield-study-rappor/dist/addon.xpi!/bootstrap.js/.././TelemetryRappor.jsm`;
const { TelemetryRappor } = Cu.import(RAPPOR_PATH, {});

const console = new ConsoleAPI({prefix: "shield-study-rappor"});

/**
 * Read the cohort and the true value from a file. (client, cohort, value).
 * @param {string} file - path containing the true values.
 */
function readCSV(file) {
  return null;
}

/**
 * write in a CSV client, cohort, bloom, prr, irr.
 * @param data - object containing the client, cohort, bloom, prr and irr.
 */
function writeCSV(data) {
  // case_reports.csv
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
    data = readCSV("case_true_values.csv");
    for (var key in data) {
      writeCSV(TelemetryRappor.createReport(client, studyName, eLTDHomepage, 16, 2, 100, 0.0, 0.35, 0.65));
    }
  },
}

