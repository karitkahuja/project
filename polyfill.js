// polyfill.js
// run this before anything else to override util._extend globally
const util = require("util");
util._extend = Object.assign;
