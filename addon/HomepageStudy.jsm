/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.S
 */

"use strict";

const {classes:Cc, interfaces: Ci, utils: Cu} = Components;

const EXPORTED_SYMBOLS = ["HomepageStudy"];

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Console.jsm");

const RAPPORPATH = `jar:file:///Users/arodriguez/src/shield/shield-study-rappor/dist/addon.xpi!/bootstrap.js/.././TelemetryRappor.jsm`;
const { TelemetryRappor } = Cu.import(RAPPORPATH, {});

const console = new ConsoleAPI({prefix: "shield-study-rappor"});

const PREF_HOMEPAGE = "browser.startup.homepage";

/**
 * @returns the eTLD+1 of the user's homeapage. If the homepage is about:home,
 * this value is returned. If it's any other about page, about:pages is returned.
 * If the return value is null, there is a error with the homepage.
 */
function getHomepage(){

  let homepage;
  try {
    homepage = Services.prefs.getComplexValue(PREF_HOMEPAGE, Ci.nsIPrefLocalizedString).data;
  } catch (e) {
    console.error("Error obtaining the homepage: ", e);
    return null;
  }
  // transform the homepage into a nsIURI. Neccesary to get the base domain
  let homepageURI;
  try {
    let uriFixup = Cc["@mozilla.org/docshell/urifixup;1"].getService(Ci.nsIURIFixup);
    homepageURI = uriFixup.createFixupURI('google.es', Ci.nsIURIFixup.FIXUP_FLAG_NONE);
  } catch (e) {
    console.error("Error creating URI from homepage string: ", e);
    return null;
  }

  let eTLD;
  if (homepage.startsWith("about:")) {
    if (homepage == "about:home") {
      eTLD = "about:home";
    } else {
      // If the homepage starts with 'about:' (see about:about) and is not about:home.
      eTLD = "about:pages";
    }
  } else {
    try {
      eTLD = Services.eTLD.getBaseDomain(homepageURI);
    } catch (e) {
      // getBaseDomain will fail if the host is an IP address or is empty.
      console.error("Error getting base domain: ", e);
      return null;
    }
  }
  return eTLD;
}


var HomepageStudy = {

/**
 * Returns the value encoded by RAPPOR or null if the homepage can't be obtained.
 * @param {string} studyName - Name of the study.
 *
 * @returns the encoded value returned by RAPPOR or null if the eTLD+1 can't be obtained.
 */
  reportValue: function(studyName) {
    var eLTDHomepage = getHomepage();
    if (eLTDHomepage == null) {
      return null;
    }
    return TelemetryRappor.createReport(studyName, eLTDHomepage, 16, 2, 100, 0.0, 0.35, 0.65);
  },
}

