/* 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

"use strict";

/* global  __SCRIPT_URI_SPEC__  */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "(startup|shutdown|install|uninstall)" }]*/

const {classes:Cc, interfaces: Ci, utils: Cu} = Components;
const CONFIGPATH = `${__SCRIPT_URI_SPEC__}/../Config.jsm`;
const { config } = Cu.import(CONFIGPATH, {});
const studyConfig = config.study;

Cu.import("resource://gre/modules/Console.jsm");
const console = new ConsoleAPI({prefix: "shield-study-rappor"});

Cu.import("resource://gre/modules/Services.jsm");

const STUDYUTILSPATH = `${__SCRIPT_URI_SPEC__}/../${studyConfig.studyUtilsPath}`;
const { studyUtils } = Cu.import(STUDYUTILSPATH, {});

const RAPPORPATH = `${__SCRIPT_URI_SPEC__}/.././TelemetryRappor.jsm`;
const { TelemetryRappor } = Cu.import(RAPPORPATH, {});

const PREF_HOMEPAGE = "browser.startup.homepage";

// addon state change reasons
const REASONS = {
  APP_STARTUP: 1,      // The application is starting up.
  APP_SHUTDOWN: 2,     // The application is shutting down.
  ADDON_ENABLE: 3,     // The add-on is being enabled.
  ADDON_DISABLE: 4,    // The add-on is being disabled. (Also sent during uninstallation)
  ADDON_INSTALL: 5,    // The add-on is being installed.
  ADDON_UNINSTALL: 6,  // The add-on is being uninstalled.
  ADDON_UPGRADE: 7,    // The add-on is being upgraded.
  ADDON_DOWNGRADE: 8,  // The add-on is being downgraded.
};

for (const r in REASONS) { REASONS[REASONS[r]] = r; }

// jsm loader / unloader
class Jsm {
  static import(modulesArray) {
    for (const module of modulesArray) {
      console.log(`loading ${module}`);
      Cu.import(module);
    }
  }
  static unload(modulesArray) {
    for (const module of modulesArray) {
      console.log(`Unloading ${module}`);
      Cu.unload(module);
    }
  }
}

async function startup(addonData, reason) {
  Jsm.import(config.modules);

  studyUtils.setup({
    studyName: studyConfig.studyName,
    endings: studyConfig.endings,
    addon: {
      id: addonData.id,
      version: addonData.version
    },
    telemetry: studyConfig.telemetry,
  });
  studyUtils.setLoggingLevel(config.log.studyUtils.level);
  studyUtils.setVariation(studyConfig.variation);

  if ((REASONS[reason]) === "ADDON_INSTALL") {
    studyUtils.firstSeen();  // sends telemetry "enter"
    const eligible = await config.isEligible(); // addon-specific
    if (!eligible) {
      // uses config.endings.ineligible.url if any,
      // sends UT for "ineligible"
      // then uninstalls addon
      await studyUtils.endStudy({reason: "ineligible"});
      return;
    }
  }
  await studyUtils.startup({reason});

  console.log(`info ${JSON.stringify(studyUtils.info())}`);
  // get the homepage and run RAPPOR
  let eLTDHomepages = getHomepage();
  if (eLTDHomepages == null) {
    studyUtils.endStudy({reason: "incorrect homepage"});
  }
  let rappor = TelemetryRappor.createReport(studyUtils.studyName, eLTDHomepages, 16, 2, 100, 0.0, 0.35, 0.65);

  // Send RAPPOR response to Telemetry
  studyUtils.telemetry({
    cohort: rappor.cohort.toString(),
    report: rappor.report
  });
  //studyUtils.endStudy({reason: "done"});
}

function unload() {
  // normal shutdown, or 2nd attempts
  console.log("Jsms unloading");
  Jsm.unload(config.modules);
  Jsm.unload([CONFIGPATH, STUDYUTILSPATH, RAPPORPATH]);
}

function shutdown(addonData, reason) {
  console.log("shutdown", REASONS[reason] || reason);
  // are we uninstalling?
  // if so, user or automatic?
  if (reason === REASONS.ADDON_UNINSTALL || reason === REASONS.ADDON_DISABLE) {
    console.log("uninstall or disable");
    if (!studyUtils._isEnding) {
      // we are the first requestors, must be user action.
      console.log("user requested shutdown");
      studyUtils.endStudy({reason: "user-disable"});
    }
  }
  unload();
}

function uninstall(addonData, reason) {
  console.log("uninstall", REASONS[reason] || reason);
}

function install(addonData, reason) {
  console.log("install", REASONS[reason] || reason);
  // handle ADDON_UPGRADE (if needful) here
}

function getHomepage(){
  // get the homepage of the user
  var homepage;
  try {
    homepage = Services.prefs.getComplexValue(PREF_HOMEPAGE, Ci.nsIPrefLocalizedString).data;
  } catch (e) {
    console.error("Error obtaining the homepage: ", e);
    return null;
  }
  // transform the homepage into a nsIURI. Neccesary to get the base domain
  var homepageURI;
  // TODO: FIX PROBLEM WITH MALFORMED URIS (google.es/)
  try {
    homepageURI = Services.netUtils.newURI(homepage);
  } catch (e) {
    console.error("Error creating URI from homepage string: ", e);
    return null;
  }

  var eTLD;
  if (homepage.startsWith("about:")) {
    // If the homepage starts with 'about:' (see about:about)
    eTLD = "about:pages";
  } else {
    try {
      eTLD = Services.eTLD.getBaseDomain(homepageURI);
    } catch (e) {
      // getBaseDomain will fail if the host is an IP address or is empty
      console.error("Error getting base domain: ", e);
      return null;
    }
  }
  return eTLD;
}