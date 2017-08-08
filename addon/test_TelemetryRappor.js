/* 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

"use strict";

function equals(array1, array2){
    if (array1.length != array2.length) { return false; }

    for (let i = 0; i < array1.length; i++) {
        if(array1[i] !== array2[i]) {
            return false;
        }
    }
    return true;
}

function test_bf_or_equals() {
    let a = new Uint8Array([1, 0, 1, 0]);
    let b = new Uint8Array([0, 1, 0 ,1]);
    let expected = new Uint8Array([1, 1, 1, 1]);

    return equals(TelemetryRappor.internal.bf_or(a, b), expected);
}

function test_bf_and_equals() {
    let a = new Uint8Array([1, 0, 1, 1]);
    let b = new Uint8Array([1, 1, 0 , 1]);
    let expected = new Uint8Array([1, 0, 0, 1]);

    return equals(TelemetryRappor.internal.bf_and(a, b), expected);
}

function test_bf_or_not_equals() {
    let a = new Uint8Array([1, 0, 1, 0]);
    let b = new Uint8Array([0, 1, 0 ,1]);
    let expected = new Uint8Array([1, 0, 1, 1]);

    return !equals(TelemetryRappor.internal.bf_or(a, b), expected);
}

function test_bf_and_not_equals() {
    let a = new Uint8Array([1, 0, 1, 1]);
    let b = new Uint8Array([1, 1, 0 , 1]);
    let expected = new Uint8Array([1, 0, 1, 1]);

    return !equals(TelemetryRappor.internal.bf_and(a, b), expected);
}

function test_bf_mask_equals() {
    let mask = new Uint8Array([7, 7, 7, 7]);
    let lhs = new Uint8Array([7, 3, 3, 7]);
    let rhs = new Uint8Array([1, 7, 1, 1]);
    let expected = new Uint8Array([1, 7, 1, 1]);
    return equals(TelemetryRappor.internal.bf_mask(mask, lhs, rhs), expected);
}

function test_bf_mask_not_equals() {
    let mask = new Uint8Array([7, 7, 7, 7]);
    let lhs = new Uint8Array([7, 3, 3, 7]);
    let rhs = new Uint8Array([7, 7, 1, 1]);
    let expected = new Uint8Array([1, 7, 1, 1]);
    return !equals(TelemetryRappor.internal.bf_mask(mask, lhs, rhs), expected);
}

function test_bytesFromOctetString_equals() {
    let str = "fcfc";
    let expected = new Uint8Array([102, 99, 102, 99]);

    return equals(TelemetryRappor.internal.bytesFromOctetString(str), expected);
}

function test_bytesFromOctetString_not_equals() {
    let str = "fcfg";
    let expected = new Uint8Array([102, 99, 102, 99]);

    return !equals(TelemetryRappor.internal.bytesFromOctetString(str), expected);
}

function test_bytesToHex_equals() {
    let bytes = new Uint8Array([102, 99]);
    let expected = "6663";

    return equals(TelemetryRappor.internal.bytesToHex(bytes), expected);
}

function test_bytesToHex_not_equals() {
    let bytes = new Uint8Array([102, 9]);
    let expected = "6663";

    return !equals(TelemetryRappor.internal.bytesToHex(bytes), expected);
}

function test_setBit_equals() {
    let byteArray = new Uint8Array([0, 0, 0, 0]);
    let expected = new Uint8Array([4, 1, 0, 8]);

    TelemetryRappor.internal.setBit(byteArray, 2);
    TelemetryRappor.internal.setBit(byteArray, 8);
    TelemetryRappor.internal.setBit(byteArray, 27);

    return equals(byteArray, expected);
}

function test_setBit_not_equals() {
    let byteArray = new Uint8Array([0, 0, 0, 0]);
    let expected = new Uint8Array([4, 1, 65, 8]);

    TelemetryRappor.internal.setBit(byteArray, 2);
    TelemetryRappor.internal.setBit(byteArray, 8);
    TelemetryRappor.internal.setBit(byteArray, 27);

    return !equals(byteArray, expected);
}

function test_getBit_true() {
    let byteArray = new Uint8Array([4, 1, 3 ,8]);
    let n = 2;
    let expected = true;

    return TelemetryRappor.internal.getBit(byteArray, n) === expected;

}

function test_getBit_false() {
    let byteArray = new Uint8Array([4, 1, 3 ,8]);
    let n = 1;
    let expected = false;

    return !TelemetryRappor.internal.getBit(byteArray, n) === expected;
}


function test_bf_random() {
    let b = new Uint8Array([1, 3, 7, 0]);
    let rand = TelemetryRappor.internal.makePRNG("secret" + "\0" + "name" + "\0"
                                        + TelemetryRappor.internal.bytesToHex(b));
    let k = b.length;
    let p = 0.5;
    let expected;
    //console.log(TelemetryRappor.internal.bf_random(rand, k, p) === expected);

}

function test_bf_signal_equals() {
    let v = "hello";
    let k = 4;
    let h = 2;
    let cohort = 10;
    let expected = new Uint8Array([ 4, 0, 0, 1 ]);
    return equals(TelemetryRappor.internal.bf_signal(v, k, h, cohort), expected);
}

function test_bf_signal_not_equals() {
    let v = "hello";
    let k = 4;
    let h = 2;
    let cohort = 11;
    let expected = new Uint8Array([ 4, 0, 0, 1 ]);
    return !equals(TelemetryRappor.internal.bf_signal(v, k, h, cohort), expected);
}

function test_bf_prr_equals() {
    let b = new Uint8Array([ 4, 0, 0, 1 ]);
    let f = 0.5;
    let secret = "secret";
    let name = "name";
    let expected = new Uint8Array([[ 156, 24, 0, 193 ]]);
    return equals(TelemetryRappor.internal.bf_prr(b, f, secret, name), expected);
}

function test_bf_prr_not_equals() {
    let b = new Uint8Array([ 4, 0, 1, 1 ]);
    let f = 0.5;
    let secret = "secret";
    let name = "name";
    let expected = new Uint8Array([[ 156, 24, 0, 193 ]]);
    return !equals(TelemetryRappor.internal.bf_prr(b, f, secret, name), expected);
}

function test_bf_irr() {
    let b_;
    let p;
    let q;
    let expected;
    //console.log(TelemetryRappor.internal.bf_irr(b_, p, q) === expected);
}

function run(){
    print("--- Running tests... ---");

    print("– Test bloom filter or:");
    print("\t test_bf_or_true:", test_bf_or_true());
    print("\t test_bf_or_false:", test_bf_or_false());

    print("– Test bloom filter and:");
    print("\t test_bf_and_true:", test_bf_and_true());
    print("\t test_bf_and_false:", test_bf_and_false());

    print("– Test bytes from string:");
    print("\t", test_bytesFromOctetString_true());
    print("\t", test_bytesFromOctetString_false());

    print("– Test bytes to hex:");
    print("\t", test_bytesToHex_true());
    print("\t", test_bytesToHex_false());

    print("– Test set bit:");
    print("\t", test_setBit_true());
    print("\t", test_setBit_false());

    print("– Test get bit:");
    print("\t", test_getBit_true());
    print("\t", test_getBit_false());
}