/* 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

"use strict";

const {Cu} = require("chrome");
const test = require("sdk/test");

const {TelemetryRappor} = require(".././TelemetryRappor.jsm");

let TRI = TelemetryRappor.internal;
let bf_or = TRI.bf_or;

function test_bf_or() {
    let a = new Uint8Array([1, 0, 1, 0]);
    let b = new Uint8Array([0, 1, 0 ,1]);
    let expected = new Uint8Array([1, 1, 1, 1]);
    ok(bf_or(a, b) === expected);
}

function test_bf_and() {
    let a = new Uint8Array([1, 0, 1, 1]);
    let b = new Uint8Array([1, 1, 0 ,1]);
    let expected = new Uint8Array([1, 0, 0, 1]);
    ok(bf_or(a, b) === expected);
}

function test_bf_mask() {
    let mask = new Uint8Array([]);
    bf_mask(mask, lhs, rhs)
}

function test_bytesFromOctetString() {
    let str = "fcfc";
    let expected = new Uint8Array()
bytesFromOctetString(str);
}

function test_bytesToHex() {
bytesToHex(bytes);
}

function test_setBit() {
setBit(byteArray, n);
}

function test_getBit() {
getBit(byteArray, n);
}

function test_digest() {
digest(h,s);
}

function test_bf_random() {
    
}

function test_bf_signal() {

}

function test_bf_prr() {

}

function test_bf_irr() {

}