// server/models/CodeSnippet.js
const mongoose = require('mongoose');

const codeSnippetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  language: {
    type: String,
    required: true
  },
  code: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: 'Untitled'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('CodeSnippet', codeSnippetSchema);
