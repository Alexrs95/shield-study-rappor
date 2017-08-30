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
Cu.import("resource://gre/modules/Log.jsm");

const PREF_HOMEPAGE = "browser.startup.homepage";

const TELEMETRY_RAPPOR_PATH = `chrome://shield-study-rappor/content/TelemetryRappor.jsm`;
const { TelemetryRappor } = Cu.import(TELEMETRY_RAPPOR_PATH, {});

const UTILS_PATH = `chrome://shield-study-rappor/content/Utils.jsm`;
const { Utils } = Cu.import(UTILS_PATH, {});

const log = createLog("HomepageStudy", "Info");

/**
 * Create the logger
 * @param {string} name - Name to show in the logs.
 * @param {string} level - Log level.
 */
function createLog(name, level) {
  var logger = Log.repository.getLogger(name);
  logger.level = Log.Level[level] || Log.Level.Debug;
  logger.addAppender(new Log.ConsoleAppender(new Log.BasicFormatter()));
  return logger;
}

/**
 * Get the user's homepage. If the homepage is about:home, this value is returned.
 * If it's any other about page, about:pages is returned. If the return value is null,
 * there is a error with the homepage.
 * This function will fail if the host is an IP address or is empty when calling Services.eTLD.getBaseDomain.
 * @returns the eTLD+1 of the user's homeapage or null.
 */
function getHomepage() {
  let homepage;
  try {
    homepage = Services.prefs.getComplexValue(PREF_HOMEPAGE, Ci.nsIPrefLocalizedString).data;
  } catch (e) {
    log.error("Error obtaining the homepage: ", e);
    return null;
  }
  // Transform the homepage into a nsIURI. Neccesary to get the base domain.
  let homepageURI;
  try {
    let uriFixup = Cc["@mozilla.org/docshell/urifixup;1"].getService(Ci.nsIURIFixup);
    homepageURI = uriFixup.createFixupURI(homepage, Ci.nsIURIFixup.FIXUP_FLAG_NONE);
  } catch (e) {
    log.error("Error creating URI from homepage string: ", e);
    return null;
  }

  if (homepage.startsWith("about:")) {
    return (homepage === "about:home") ? homepage : "about:pages";
  }

  let eTLD;
  try {
    eTLD = Services.eTLD.getBaseDomain(homepageURI);
  } catch (e) {
    log.error("Error getting base domain: ", e);
    return null;
  }
  return eTLD;
}

/**
 * Returns the correct parameters depending if it's a standalone execution or a simulation.
 * @param {boolean} isSimulation - Boolean indicating if the addon is run for a simulation.
 * @param {string} rapporPath  - Path of the RAPPOR simulator.
 */
function getParams(isSimulation, rapporPath) {
  if (!isSimulation) {
    return {filterSize: 16, numHashFunctions: 2, cohorts: 100, f: 0.0, p: 0.35, q: 0.65};
  }

  let params = Utils.read(new FileUtils.File(rapporPath + "_tmp/python/r-zipf1.5-tiny2-sim_final2/case_params.csv"));
  // In the file, the filterSize (k) value is in bits, but here we use bytes.
  let filterSize = parseInt(params[1].split(",")[0], 10) / 8;
  let numHashFunctions = parseInt(params[1].split(",")[1], 10);
  let cohorts = parseInt(params[1].split(",")[2], 10);
  let p = parseFloat(params[1].split(",")[3]);
  let q = parseFloat(params[1].split(",")[4]);
  let f = parseFloat(params[1].split(",")[5]);

  return {filterSize: filterSize, numHashFunctions: numHashFunctions, cohorts: cohorts, f: f, p: p, q: q};
}

function runRapporSimulation(studyName, rapporPath, params) {
  let data = Utils.read(new FileUtils.File(rapporPath + "_tmp/python/r-zipf1.5-tiny2-sim_final2/1/case_true_values.csv"));
  let caseReportsFile = new FileUtils.File(rapporPath + "_tmp/python/r-zipf1.5-tiny2-sim_final2/1/case_reports.csv");
  Utils.write(caseReportsFile, "client, cohort, bloom, prr, irr\n");
  // iterate over each line of the file getting the
  // client, cohort and value.
  for (let i = 1; i < data.length; i++) {
    let line = data[i].split(",");
    let report = TelemetryRappor.createReport(studyName, line[2], params, true, line[1]);
    Utils.write(caseReportsFile,
      line[0] + ","+ line[1] + "," + Utils.convertToBin(report.bloom) + "," + Utils.convertToBin(report.prr) + "," + Utils.convertToBin(report.irr) + "\n");
  }
}

var HomepageStudy = {
/**
 * Returns the value encoded by RAPPOR or null if the homepage can't be obtained.
 * @param {string} studyName - Name of the study.
 *
 * @returns the encoded value returned by RAPPOR or null if the eTLD+1 can't be obtained.
 */
  reportValue(studyName, isSimulation, rapporPath) {
    let params = getParams(isSimulation, rapporPath);

    if (isSimulation){
      runRapporSimulation(studyName, rapporPath, params);
    } else {
      let eTLDHomepage = getHomepage();
      if (!eTLDHomepage) {
        return null;
      }
      let report = TelemetryRappor.createReport(studyName, eTLDHomepage, params);
      return {
        report: report.irr,
        cohort: report.cohort
      }
    }
  },
}

