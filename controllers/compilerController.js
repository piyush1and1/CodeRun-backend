// server/controllers/compilerController.js
const { submitCode, formatResult, getLanguageId } = require('../config/judge0');
const { asyncHandler } = require('../middleware/errorHandler');

const PROJECT_SUPPORTED_LANGUAGES = ['cpp', 'java', 'javascript', 'python'];

exports.compileCode = asyncHandler(async (req, res) => {
  const { language, code, input } = req.body;

  if (!language || !code) {
    return res.status(400).json({ message: 'Language and code are required' });
  }

  const lowerLang = language.toLowerCase();

  if (!PROJECT_SUPPORTED_LANGUAGES.includes(lowerLang)) {
    return res.status(400).json({ 
      message: `Unsupported language. This compiler only supports: ${PROJECT_SUPPORTED_LANGUAGES.join(', ')}` 
    });
  }

  const languageId = getLanguageId(lowerLang);
  if (!languageId) {
    console.error(`Configuration error: Language "${lowerLang}" not found in judge0.js map.`);
    return res.status(500).json({ message: 'Internal server configuration error.' });
  }

  const submission = await submitCode({
    language: lowerLang,
    code,
    input,
  });

  if (!submission.success) {
    return res.status(submission.statusCode || 500).json({
      message: 'Code execution failed',
      error: submission.error,
    });
  }

  const formattedResult = formatResult(submission.data);

  res.status(200).json(formattedResult);
});