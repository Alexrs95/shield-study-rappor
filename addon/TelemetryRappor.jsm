/* 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

"use strict";

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

const EXPORTED_SYMBOLS = ["TelemetryRappor"];

const PREF_RAPPOR_PATH = "toolkit.telemetry.rappor.";
const PREF_RAPPOR_SECRET = PREF_RAPPOR_PATH + "secret";

Cu.import("resource://gre/modules/Console.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.importGlobalProperties(['crypto']);

const console = new ConsoleAPI({prefix: "shield-study-rappor"});

var bytesFromOctetString = str => new Uint8Array([for (i of str) i.charCodeAt(0)]);

var bytesToHex = bytes => [for (b of bytes) ("0" + b.toString(16)).slice(-2)].join("");

// Set a bit in a byte array (bloom filters are represented as byte arrays).
var setBit = (byteArray, n) => byteArray[n>>3] |= (1 << (n & 7));

// Return true if a bit is set in the byte array.
var getBit = (byteArray, n) => !!(byteArray[n >> 3] & (1 << (n & 7)));

// Merge two bloom filters using a mask.
function mask(mask, lhs, rhs) {
  let array = new Uint8Array(mask.length);
  for (let i = 0; i < array.length; i++) {
    array[i] = (lhs[i] & ~mask[i]) | (rhs[i] & mask[i]);
  }
  return array;
}

// Get the byte representation of an UTF-8 string.
function bytesFromUTF8(str) {
  let conv =
  Cc["@mozilla.org/intl/scriptableunicodeconverter"]
    .createInstance(Ci.nsIScriptableUnicodeConverter);
  conv.charset = "UTF-8";
  return conv.convertToByteArray(str);
}

// Allocate an HMAC key.
function makeHMACKey(secret) {
  return Cc["@mozilla.org/security/keyobjectfactory;1"]
  .getService(Ci.nsIKeyObjectFactory)
  .keyFromString(Ci.nsIKeyObject.HMAC, secret);
}

// Allocate an HMAC hasher.
function makeHMACHasher() {
  return Cc["@mozilla.org/security/hmac;1"]
  .createInstance(Ci.nsICryptoHMAC);
}

// Digest a string through a hasher and reset the hasher.
function digest(h, s) {
  let bytes = bytesFromOctetString(s);
  h.update(bytes, bytes.length);
  let result = h.finish(false);
  h.reset();
  return result;
}

// Return a PRNG that generates pseudo-random values based on a seed.
function makePRNG(seed) {
  let h = makeHMACHasher();
  h.init(Ci.nsICryptoHMAC.SHA256, makeHMACKey("\0\0\0\0\0\0\0\0" +
                                              "\0\0\0\0\0\0\0\0" +
                                              "\0\0\0\0\0\0\0\0" +
                                              "\0\0\0\0\0\0\0\0"));
  let prk = digest(h, seed);
  h = makeHMACHasher(prk);
  h.init(Ci.nsICryptoHMAC.SHA256, makeHMACKey(prk));
  let i = 0;
  let previous = "";
  return function (length) {
    let result = "";
    while (result.length < length) {
      previous = digest(h, previous + String.fromCharCode(++i));
      result += previous;
    }
    return bytesFromOctetString(result.substr(0, length));
  };
}

// Hash client’s value v (string) onto the Bloom filter B of size k (in bytes) using
// h hash functions and the given cohort.
function encode(value, filterSize, numHashFunctions, cohort) {
  let bloomFilter = new Uint8Array(filterSize);
  let data = bytesFromUTF8(value);
  let hash = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
  for (let n = 0; n < numHashFunctions; n++) {
    hash.init(Ci.nsICryptoHash.SHA256);
    // Seed the hash function with the cohort and the hash function number. Since we
    // are using a strong hash function we can get away with using [0..k] as seed
    // instead of using actually different hash functions.
    let seed = bytesFromOctetString(cohort + "" + n);
    hash.update(seed, seed.length);
    hash.update(data, data.length);
    let result = hash.finish(false);
    // The last 2 bytes of the result as the bit index is sufficient for bloom filters
    // of up to 65536 bytes in length.
    let idx = result.charCodeAt(result.length - 1) | (result.charCodeAt(result.length - 2) << 8);
    // Set the corresponding bit in the bloom filter. Shift 3 bits to select the index, as k is
    // represented in bytes, we need to shift 3 bits to get the correspondign bit (1 byte = 8 bits = 2^3).
    setBit(bloomFilter, idx % (filterSize << 3));
  }
  return bloomFilter;
}

function getPermanentRandomizedResponse(bloomFilter, f, secret, name) {
  // Uniform bits are 1 with probability 1/2, and fMask bits are 1 with
  // probability f.  So in the expression below:
  //   - Bits in (uniform & fMask) are 1 with probability f/2.
  //   - (bloom_bits & ~fMask) clears a bloom filter bit with probability
  //   f, so we get B_i with probability 1-f.
  //   - The remaining bits are 0, with remaining probability f/2.
  let filterSize = bloomFilter.length;
  // As Chrome we diverge from the paper a bit and don't actually randomly
  // generate the fake data here. Instead we use a permanently stored
  // secret (string), the name of the metric (string), and the data itself
  // to feed a PRNG.
  let uniform = new Uint8Array(filterSize);
  let fMask = new Uint8Array(filterSize);
  // Calculate the number of bits in the array.
  let bits = filterSize * 8;
  // the value of threshold128 is the maxium value for which the byte from the digest
  // is true (1) or false (0) in the bloom filter.
  let threshold128 = f * 128;
  let prng = makePRNG(secret + "\0" + name + "\0" + bytesToHex(b));
  // Get a digest with the same length as the number of bits in the bloom filter.
  let digestBytes = prng(bits);
  for (let i = 0; i < bits; i++) {
    // Calculate the index of the bit to set. This must be done because
    // we have to set individual bits to one or zero, but what we have are bytes.
    let idx = Math.floor(i/8);

    // uBit is true (1) if it's odd. False if even. Then, probability of
    // being 1 is 1/2.
    // 1 bit of entropy.
    let uBit = digestBytes[i] & 0x01;
    uniform[idx] |= (uBit << i % 8);

    // digestBytes[i] is a byte, with range 0 - 255.
    // we need a number between 0 and 127, so the last
    // bit of digestBytes[i] is discarded.
    let rand128 = digestBytes[i] >> 1; // 7 bits of entropy
    // Check if the value is less than the maxium value for which
    // the byte from the digest is true.
    let noiseBit = (rand128 < threshold128);
    fMask[idx] |= (noiseBit << i % 8);
  }
  return mask(fMask, bloomFilter, uniform);
}

// Create an instanteneous randomized response, based on the previously generated
// permanent randomized response getPermanentRandomizedResponse, and using the probabilities p and q
// If PRR bit is 0, IRR bit is 1 with probability p.
// If PRR bit is 1, IRR bit is 1 with probability q.
function getInstantaneousRandomizedResponse(prr, p, q) {
  let filterSize = prr.length;
  let pGen = getBloomBits(p, filterSize);
  let qGen = getBloomBits(p, filterSize);
  return mask(prr, pGen, qGen);
}

function getBloomBits(prob, filterSize) {
  let arr = new Uint8Array(filterSize);
  // Calculate the number of bits in the array
  let bits = filterSize * 8;
  for (let i = 0; i < bits; i++) {
    // Check whether a random number is higher or not than the given probability.
    let bit = getRandomFloat() < prob;
    // Calculate the index of the bit to set. This must be done because
    // we have to set individual bits to one or zero, but what we have are bytes.
    let idx = Math.floor(i/8);
    // Set the corresponding bit in the bloom filter to its value. We're using here
    // the boolean 'bit' as an int (1 if true, 0 if false).
    arr[idx] |= (bit << (i % 8));
  }
  return arr;
}

function getRandomFloat() {
  // A buffer with just the right size to convert to Float64.
  let buffer = new ArrayBuffer(8);

  // View it as an Int8Array and fill it with 8 random ints.
  let ints = new Int8Array(buffer);
  crypto.getRandomValues(ints);

  // Set the sign (ints[7][7]) to 0 and the exponent (ints[7][6]-[6][5]) to just the
  // right size (all ones except for the highest bit).
  ints[7] = 63;
  ints[6] |= 0xf0;

  // Now view it as a Float64Array, and read the one float from it.
  return new Float64Array(buffer)[0] - 1;
}

// Create a report.
function createReport(value, filterSize, numHashFunctions, p, q, f, cohort, secret, name) {
  // Instead of storing a permanent randomized response, we use a PRNG and a stored
  // secret to re-compute B' on the fly every time we send a report.
  let boomFilter = encode(value, filterSize, numHashFunctions, cohort);
  let prr = getPermanentRandomizedResponse(bloomFilter, f, secret, name);
  let irr = getInstantaneousRandomizedResponse(prr, p, q);
  return irr;
}

var TelemetryRappor = {
  /*
   * createReport receives the parameters for RAPPOR and returns the IRR.
   * params:
   *  - name: name of the experiment. Used to store the preferences.
   *  - value v: value to submit
   *  - filterSize k (optional, default 16 (128 bits)): size of the bloom filter in bytes.
   *  - numHashFunctions h (optional, default 2): number of hash functions.
   *  - cohorts (optional, default 100): number of cohorts to use.
   *  - f (optional, default 0.0): value for probability f.
   *  - p (optional, default 0.35): value for probability p.
   *  - q (optional, default 0.65): value for probability q.
   */
  createReport: function(name, value, filterSize = 16, numHashFunctions = 2, cohorts = 100, f = 0.0, p = 0.35, q = 0.65) {
    // Generate the RAPPOR secret. This secret
    // never leaves the client.
    let secret = null;
    try {
      secret = Services.prefs.getCharPref(PREF_RAPPOR_SECRET);
      if (secret.length != 64) {
        secret = null;
      }
    } catch (e) {
      console.log("Error getting secret from prefs", e);
    }
    if (secret === null) {
      let randomArray = new Uint8Array(32);
      crypto.getRandomValues(randomArray);
      secret = bytesToHex(randomArray);
      Services.prefs.setCharPref(PREF_RAPPOR_SECRET, secret);
    }

    // If we haven't self-selected a cohort yet for this measurement, then do so now,
    // otherwise retrieve the cohort.
    let cohort = null;
    try {
      cohort = Services.prefs.getIntPref(PREF_RAPPOR_PATH + name + ".cohort");
    } catch (e) {
      console.log(e);
    }
    if (cohort === null) {
      cohort = Math.floor(getRandomFloat() * cohorts);
      Services.prefs.setIntPref(PREF_RAPPOR_PATH + name + ".cohort", cohort);
    }

    return {
      cohort: cohort,
      report: bytesToHex(createReport(value, filterSize, numHashFunctions, p, q, f, cohort, secret, name)),
    };
  },

  // Expose internal functions for testing purpose.
  internal: {
    bytesFromOctetString: bytesFromOctetString,
    bytesToHex: bytesToHex,
    setBit: setBit,
    getBit: getBit,
    mask: mask,
    getInstantaneousRandomizedResponse: getInstantaneousRandomizedResponse,
    getPermanentRandomizedResponse: getPermanentRandomizedResponse,
    encode: encode,
    bytesFromUTF8: bytesFromUTF8,
    makeHMACKey: makeHMACKey,
    makeHMACHasher: makeHMACHasher,
    digest: digest,
    makePRNG: makePRNG,
    createReport: createReport, 
  },
};
