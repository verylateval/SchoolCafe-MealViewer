const NodeHelper = require("node_helper");
import library from './library.js'

const myModule= module.exports = NodeHelper.create(library);
myModule.allFunctions.initialize(this)
