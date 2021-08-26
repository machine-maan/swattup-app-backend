const mongoose = require('mongoose');
const db = require('../models')
const baseService = require('./baseService');
const ObjectId = mongoose.Types.ObjectId
const model = db.KnowledgeBank;
baseService.model = model;

module.exports = {
    ...baseService,
}