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
Cu.import("resource://gre/modules/FileUtils.jsm");

const RAPPOR_PATH = `chrome://shield-study-rappor/content/TelemetryRappor.jsm`;
const { TelemetryRappor } = Cu.import(RAPPOR_PATH, {});

const UTILS_PATH = `chrome://shield-study-rappor/content/Utils.jsm`;
const { Utils } = Cu.import(UTILS_PATH, {});


const console = new ConsoleAPI({prefix: "shield-study-rappor"});

var HomepageStudy = {
/**
 * Returns the value encoded by RAPPOR or null if the homepage can't be obtained.
 * @param {string} studyName - Name of the study.
 *
 * @returns the encoded value returned by RAPPOR or null if the eTLD+1 can't be obtained.
 */
  reportValue(studyName) {
    // iterate over each line of the file
    let data = Utils.readCSV(new FileUtils.File("/Users/arodriguez/src/shield/shield-study-rappor/_tmp/python/r-zipf1.5-tiny2-sim_final2/1/case_true_values.csv"));
    let params = Utils.readCSV(new FileUtils.File("/Users/arodriguez/src/shield/shield-study-rappor/_tmp/python/r-zipf1.5-tiny2-sim_final2/case_params.csv"));
    let k = parseInt(params[1].split(",")[0], 10);
    let h = parseInt(params[1].split(",")[1], 10);
    let m = parseInt(params[1].split(",")[2], 10);
    let p = parseFloat(params[1].split(",")[3]);
    let q = parseFloat(params[1].split(",")[4]);
    let f = parseFloat(params[1].split(",")[5]);

    Utils.writeCSV(new FileUtils.File("/Users/arodriguez/src/shield/shield-study-rappor/_tmp/python/r-zipf1.5-tiny2-sim_final2/1/case_reports.csv"),
    "client, cohort, bloom, prr, irr\n");
    for (let i = 1; i < data.length; i++) {
      let line = data[i].split(",");
      let report = TelemetryRappor.createReport(/*client*/ line[0], studyName, /*eLTDHomepage*/ line[2], k/8, h, m, f, p, q, /*cohort*/ line[1]);
      // client,cohort,bloom,prr,irr
      Utils.writeCSV(new FileUtils.File("/Users/arodriguez/src/shield/shield-study-rappor/_tmp/python/r-zipf1.5-tiny2-sim_final2/1/case_reports.csv"),
        line[0] + ","+ line[1] + "," + Utils.convertToBin(report.bloom) + "," + Utils.convertToBin(report.prr) + "," + Utils.convertToBin(report.irr) + "\n");
    }
  },
}

