const {Cu} = require("chrome");

exports.test_hello = function*(assert) {
  assert.ok("hello" == "hello", "hello works");
}

require("sdk/test").run(exports);