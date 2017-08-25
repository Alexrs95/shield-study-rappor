/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

"use strict";

const {utils: Cu} = Components;


const EXPORTED_SYMBOLS = ["Utils"];

Cu.import("resource://gre/modules/Log.jsm");

var Utils = {
  /**
   * Creates the logger
   * @param {string} name - Name to show when logging.
   * @param {string} level - Level of log.
   */
  createLog(name, level) {
    var logger = Log.repository.getLogger(name);
    logger.level = Log.Level[level] || Log.Level.Debug;
    logger.addAppender(new Log.ConsoleAppender(new Log.BasicFormatter()));
    return logger;
  }
}