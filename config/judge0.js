const axios = require('axios');

const judge0Config = {
  baseURL: process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

if (process.env.JUDGE0_API_KEY) {
  judge0Config.headers['X-RapidAPI-Key'] = process.env.JUDGE0_API_KEY;
  judge0Config.headers['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
}

const judge0Client = axios.create(judge0Config);

const languageMap = {
  javascript: 63,
  python: 71,
  java: 62,
  cpp: 54,
  c: 50,
  csharp: 51,
  go: 60,
  rust: 73,
  php: 68,
  ruby: 72,
  swift: 83,
  kotlin: 78,
  typescript: 74,
  scala: 81,
};

const idToLanguageMap = Object.entries(languageMap).reduce((acc, [k, v]) => {
  acc[v] = k;
  return acc;
}, {});

const getLanguageId = (language) => {
  return languageMap[language.toLowerCase()] || null;
};

const getLanguageName = (id) => {
  return idToLanguageMap[id] || null;
};

const getSupportedLanguages = () => {
  return Object.entries(languageMap).map(([name, id]) => ({ name, id }));
};

const submitCode = async (options) => {
  try {
    const {
      language,
      code,
      input = '',
      cpuTimeLimit = 5,
      memoryLimit = 262144,
    } = options;

    if (!language || !code) throw new Error('Language and code are required');
    if (code.length > 500000)
      throw new Error('Code size exceeds maximum limit (500KB)');

    const languageId = getLanguageId(language);
    if (!languageId) throw new Error(`Unsupported language: ${language}`);

    const payload = {
      language_id: languageId,
      source_code: code,
      stdin: input,
      cpu_time_limit: cpuTimeLimit,
      memory_limit: memoryLimit,
    };

    const response = await judge0Client.post(
      '/submissions?base64_encoded=false&wait=true',
      payload
    );

    return { success: true, data: response.data };
  } catch (error) {
    console.error('Judge0 submission error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.response?.data || error.message,
      statusCode: error.response?.status || 500,
    };
  }
};

const getSubmissionResult = async (token) => {
  try {
    if (!token) throw new Error('Token is required');

    const response = await judge0Client.get(
      `/submissions/${token}?base64_encoded=false`
    );

    return { success: true, data: response.data };
  } catch (error) {
    console.error('Judge0 get result error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      statusCode: error.response?.status || 500,
    };
  }
};

const getBatchResults = async (tokens) => {
  try {
    if (!Array.isArray(tokens) || tokens.length === 0)
      throw new Error('Tokens array is required');

    const tokenString = tokens.join(',');
    const response = await judge0Client.get(
      `/submissions/batch?tokens=${tokenString}&base64_encoded=false`
    );

    return { success: true, data: response.data };
  } catch (error) {
    console.error('Judge0 batch error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      statusCode: error.response?.status || 500,
    };
  }
};

const formatResult = (result) => {
  const {
    stdout,
    stderr,
    compile_output,
    status,
    time,
    memory,
    language_id,
    exit_code,
    signal,
  } = result;

  return {
    output: stdout ? stdout.trim() : '',
    error: stderr || compile_output || '',
    status: status?.description || 'Unknown',
    executionTime: parseFloat(time) || 0,
    memoryUsed: memory || 0,
    language: getLanguageName(language_id),
    statusId: status?.id,
    exitCode: exit_code,
    signal,
  };
};

const getStatusDescription = (statusId) => {
  const statusMap = {
    1: 'In Queue',
    2: 'Processing',
    3: 'Accepted',
    4: 'Wrong Answer',
    5: 'Time Limit Exceeded',
    6: 'Compilation Error',
    7: 'Runtime Error',
    8: 'Internal Error',
    9: 'Exec Format Error',
  };
  return statusMap[statusId] || 'Unknown Status';
};

const isSuccessful = (result) => result.status?.id === 3;
const hasCompilationError = (result) => result.status?.id === 6;
const hasRuntimeError = (result) => result.status?.id === 7;
const isTimeLimitExceeded = (result) => result.status?.id === 5;

module.exports = {
  judge0Client,
  languageMap,
  idToLanguageMap,
  getLanguageId,
  getLanguageName,
  getSupportedLanguages,
  submitCode,
  getSubmissionResult,
  getBatchResults,
  formatResult,
  getStatusDescription,
  isSuccessful,
  hasCompilationError,
  hasRuntimeError,
  isTimeLimitExceeded,
};
