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

const console = new ConsoleAPI({prefix: "shield-study-rappor"});

var bytesFromOctetString = str => new Uint8Array([for (i of str) i.charCodeAt(0)]);

var bytesToHex = bytes => [for (b of bytes) ("0" + b.toString(16)).slice(-2)].join("");

// Set a bit in a byte array (bloom filters are represented as byte arrays).
var setBit = (byteArray, n) => byteArray[n>>3] |= (1 << (n & 7));

// Return true if a bit is set in the byte array.
var getBit = (byteArray, n) => !!(byteArray[n >> 3] & (1 << (n & 7)));

// Or two bloom filters.
//var bf_or = (a, b) => new Uint8Array([for (i of a) a[i] | b[i]]);

function bf_or(a, b) {
    let array = new Uint8Array(a.length);
    for (var i = 0; i < array.length; i++) {
        array[i] =  a[i] | b[i];
    }
    return array;
}

// And two bloom filters.
//var bf_and = (a, b) => new Uint8Array([for (i of a) a[i] & b[i]]);
function bf_and(a, b) {
    let array = new Uint8Array(a.length);
    for (var i = 0; i < array.length; i++) {
        array[i] =  a[i] & b[i];
    }
    return array;
}

// Merge two bloom filters using a mask.
//var bf_mask = (mask, lhs, rhs) => new Uint8Array([for (i of mask) (lhs[i] & ~mask[i]) | (rhs[i] & mask[i])]);
function bf_mask(mask, lhs, rhs) {
    let array = new Uint8Array(mask.length);
    for (var i = 0; i < array.length; i++) {
        array[i] = (lhs[i] & ~mask[i]) | (rhs[i] & mask[i]);
    }
    return array;
}

// Get actually random bytes.
function getRandomBytes(length) {
    let rng = Cc["@mozilla.org/security/random-generator;1"]
    .createInstance(Ci.nsIRandomGenerator);
    return rng.generateRandomBytes(length);
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
    h = makeHMACHasher();
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

// Get a bloom filter with P(1) = {0.25, 0.5, 0.75}. We only support these specific
// probabilities because they can be calculated using fast bit math.
function bf_random(rand, k, p) {
    if (p === 0.5) {
        let r = rand(k);
        return new Uint8Array(r);
    }
    let b = bf_random(rand, k, 0.5);
    let b2 = bf_random(rand, k, 0.5);
    if (p === 0.25)
        return bf_and(b, b2);
    if (p === 0.75)
        return bf_or(b, b2);
    throw new Error("Unsupported probability: " + p);
}

// Hash client’s value v (string) onto the Bloom filter B of size k (in bytes) using
// h hash functions and the given cohort.
function bf_signal(v, k, h, cohort) {
    let b = new Uint8Array(k);
    let data = bytesFromUTF8(v);
    let hash = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
    for (let n = 0; n < h; n++) {
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
        setBit(b, idx % (k<<3));
    }
    return b;
}

// Create the permanent randomized response B' for the given real data B, using the
// longitudinal privacy guarantee f.
function bf_prr(b, f, secret, name) {
    let k = b.length;
    // As Chrome we diverge from the paper a bit and don't actually randomly
    // generate the fake data here. Instead we use a permanently stored
    // secret (string), the name of the metric (string), and the data itself
    // to feed a PRNG.
    let prng = makePRNG(secret + "\0" + name + "\0" + bytesToHex(b));
    let fake_bits = bf_random(prng, k, f/2);
    let fake_mask = bf_random(prng, k, 1-f);
    console.log("fake_bits", fake_bits, "fake_mask", fake_mask);
    // For every '0' in fake_mask use the original data, for every '1' use the
    // fake data.
    return bf_mask(fake_mask, b, fake_bits);
}

// Create an instanteneous randomized response, based on the previously generated
// permanent randomized response b_, and using the probabilities p and q (zero
// and one coin respectively).
function bf_irr(b_, p, q) {
    // Generate biased coin flips for each bit.
    let k = b_.length;
    let zero_coins = bf_random(getRandomBytes, k, p);
    let one_coins = bf_random(getRandomBytes, k, q);
    return bf_mask(b_, zero_coins, one_coins);
}

// Create a report. Instead of storing a permanent randomized response, we use
// a PRNG and a stored secret to re-compute B' on the fly every time we send
// a report.
function create_report(v, k, h, cohort, f, secret, name, p, q) {
    let b = bf_signal(v, k, h, cohort);
    console.log("original b", bytesToHex(b));
    let b_ = bf_prr(b, f, secret, name);
    console.log("prr", bytesToHex(b_));
    return bf_irr(b_, p, q);
}

var TelemetryRappor = {

    /*
     * createReport receives the parameters for RAPPOR and returns the IRR.
     * params:
     *  - name: name of the experiment. Used to store the preferences.
     *  - v: value to submit
     *  - k (optional, default 4): size of the bloom filter in bytes.
     *  - h (optional, default 2): number of hash functions
     *  - cohorts (optional, default 128): number of cohorts to use
     *  - f (optional, default 0.5): value for probability f.
     *  - p (optional, default 0.5): value for probability p
     *  - q (optional, default 0.75): value for probability q
     */
    createReport: function(name, v, k = 4, h = 2, cohorts = 128, f = 0.5, p = 0.5, q = 0.75) {
        // Retrieve (and generate if necessary) the RAPPOR secret. This secret
        // never leaves the client.
        let secret = null;
         try {
            console.log("try Secret");
            secret = Services.prefs.getCharPref(PREF_RAPPOR_SECRET);
            if (secret.length != 64) {
                secret = null;
            }
        } catch (e) {
            console.log("catch secret exceptiom", e);
        }

        if (secret === null) {
            secret = bytesToHex(getRandomBytes(32));
            Services.prefs.setCharPref(PREF_RAPPOR_SECRET, secret);
        }
        console.log("secret is", secret);

        // If we haven't self-selected a cohort yet for this measurement,
        // then do so now, otherwise retrieve the cohort.
        let cohort = null;
        try {
            cohort = Services.prefs.getIntPref(PREF_RAPPOR_PATH + name + ".cohort");
            console.log("obtaining cohort from prefs");
        } catch (e) {
            console.log(e);
        }
        if (cohort === null) {
            // TODO: Is this random secure enough? Do we need a secure random to select the cohort?
            cohort = Math.floor(Math.random() * cohorts);
            Services.prefs.setIntPref(PREF_RAPPOR_PATH + name + ".cohort", cohort);
        }
        console.log("cohort is", cohort);

        Services.prefs.setCharPref(PREF_RAPPOR_PATH + name + ".value", v);
        return {
            cohort: cohort,
            report: bytesToHex(create_report(v, k, h, cohort, f, secret, name, p, q)),
        };
    },

    // Expose internal functions for testing purpose.
    internal: {
        bytesFromOctetString: bytesFromOctetString,
        bytesToHex: bytesToHex,
        setBit: setBit,
        getBit: getBit,
        bf_or: bf_or,
        br_and: bf_and,
        bf_mask: bf_mask,
        bf_irr: bf_irr,
        bf_prr: bf_prr,
        bf_random: bf_random,
        bf_signal: bf_signal,
        getRandomBytes: getRandomBytes,
        bytesFromUTF8: bytesFromUTF8,
        makeHMACKey: makeHMACKey,
        makeHMACHasher: makeHMACHasher,
        digest: digest,
        makePRNG: makePRNG,
        create_report: create_report, 
    },
};
