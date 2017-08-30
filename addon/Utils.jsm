/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const {classes:Cc, interfaces: Ci, utils: Cu} = Components;

const EXPORTED_SYMBOLS = ["Utils"];

Cu.import("resource://gre/modules/FileUtils.jsm");

var Utils = {
/**
 * Read the cohort and the true value from a file. {client, cohort, value}.
 * @param {nsFile} file - file containing the true values.
 */
read(file) {
    // open an input stream from file
    var istream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
    istream.init(file, 0x01, 0o444, 0);
    istream.QueryInterface(Ci.nsILineInputStream);
    // read lines into array
    var line = {}, lines = [], hasmore;
    do {
      hasmore = istream.readLine(line);
      lines.push(line.value);
    } while(hasmore);

    istream.close();

    return lines;
  },

  /**
   * write in a CSV {client, cohort, bloom, prr, irr}.
   * @param {nsIFile} file - File to write in.
   * @param {string} data - String containing the client, cohort, bloom, prr and irr.
   */
  write(file, data) {
    // file is nsIFile, data is a string
    var foStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
  
    foStream.init(file, 0x02 | 0x08 | 0x10, 0o666, 0); // write | create | append
    var converter = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
    converter.init(foStream, "UTF-8", 0, 0);
    converter.writeString(data);
    converter.close(); // this closes foStream
  },

  /**
   * convert an string representing hex into a binary string.
   * @param hex - hex string to convert.
   */
  convertToBin(hex) {
    let str = parseInt(hex, 16).toString(2);
    let expected = hex.toString().length * 4;
    let real = str.length;
    while (real < expected) {
      str = '0' + str;
      real++;
    }
    return str;
  }
}

