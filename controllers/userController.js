const User = require('../models/User');
const CodeSnippet = require('../models/CodeSnippet');
const { asyncHandler } = require('../middleware/errorHandler');

exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-__v');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  res.status(200).json({
    success: true,
    user: {
      id: user._id,
      email: user.email,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    },
  });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (email && email !== req.user.email) {
    return res.status(400).json({
      success: false,
      message: 'Email cannot be changed. Please create a new account.',
    });
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { lastLogin: new Date() },
    { new: true }
  ).select('-__v');

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    user: {
      id: user._id,
      email: user.email,
      isVerified: user.isVerified,
    },
  });
});

exports.saveSnippet = asyncHandler(async (req, res) => {
  const { language, code, title } = req.body;

  if (!language || !code) {
    return res.status(400).json({
      success: false,
      message: 'Language and code are required',
    });
  }

  if (code.length > 100000) {
    return res.status(400).json({
      success: false,
      message: 'Code size exceeds maximum limit (100KB)',
    });
  }

  const validLanguages = [
    'javascript','python','java','cpp','c','csharp','go',
    'rust','php','ruby','swift','kotlin','typescript','scala'
  ];

  if (!validLanguages.includes(language.toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: `Invalid language. Supported: ${validLanguages.join(', ')}`,
    });
  }

  const snippet = await CodeSnippet.create({
    userId: req.user._id,
    language: language.toLowerCase(),
    code,
    title: title ? title.substring(0, 100) : 'Untitled',
  });

  res.status(201).json({
    success: true,
    message: 'Snippet saved successfully',
    snippet: {
      id: snippet._id,
      title: snippet.title,
      language: snippet.language,
      createdAt: snippet.createdAt,
    },
  });
});

exports.getSnippets = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, language } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const filter = { userId: req.user._id };
  if (language && language !== 'all') {
    filter.language = language.toLowerCase();
  }

  const snippets = await CodeSnippet.find(filter)
    .select('_id title language createdAt')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await CodeSnippet.countDocuments(filter);

  res.status(200).json({
    success: true,
    snippets,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit),
    },
  });
});

exports.getSnippet = asyncHandler(async (req, res) => {
  const { snippetId } = req.params;

  const snippet = await CodeSnippet.findOne({
    _id: snippetId,
    userId: req.user._id,
  });

  if (!snippet) {
    return res.status(404).json({
      success: false,
      message: 'Snippet not found',
    });
  }

  res.status(200).json({
    success: true,
    snippet,
  });
});

exports.updateSnippet = asyncHandler(async (req, res) => {
  const { snippetId } = req.params;
  const { code, title, language } = req.body;

  if (code && code.length > 100000) {
    return res.status(400).json({
      success: false,
      message: 'Code size exceeds maximum limit (100KB)',
    });
  }

  if (title && title.length > 100) {
    return res.status(400).json({
      success: false,
      message: 'Title exceeds maximum length (100 characters)',
    });
  }

  const updateData = {};
  if (code) updateData.code = code;
  if (title) updateData.title = title;
  if (language) updateData.language = language.toLowerCase();

  const snippet = await CodeSnippet.findOneAndUpdate(
    { _id: snippetId, userId: req.user._id },
    updateData,
    { new: true, runValidators: true }
  );

  if (!snippet) {
    return res.status(404).json({
      success: false,
      message: 'Snippet not found',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Snippet updated successfully',
    snippet,
  });
});

exports.deleteSnippet = asyncHandler(async (req, res) => {
  const { snippetId } = req.params;

  const snippet = await CodeSnippet.findOneAndDelete({
    _id: snippetId,
    userId: req.user._id,
  });

  if (!snippet) {
    return res.status(404).json({
      success: false,
      message: 'Snippet not found',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Snippet deleted successfully',
  });
});

exports.deleteMultipleSnippets = asyncHandler(async (req, res) => {
  const { snippetIds } = req.body;

  if (!Array.isArray(snippetIds) || snippetIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Snippet IDs array is required',
    });
  }

  const result = await CodeSnippet.deleteMany({
    _id: { $in: snippetIds },
    userId: req.user._id,
  });

  res.status(200).json({
    success: true,
    message: `${result.deletedCount} snippets deleted successfully`,
    deletedCount: result.deletedCount,
  });
});

exports.getStats = asyncHandler(async (req, res) => {
  const snippetCount = await CodeSnippet.countDocuments({
    userId: req.user._id,
  });

  const languageStats = await CodeSnippet.aggregate([
    { $match: { userId: req.user._id } },
    { $group: { _id: '$language', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const sizeStats = await CodeSnippet.aggregate([
    { $match: { userId: req.user._id } },
    { $group: { _id: null, totalSize: { $sum: { $strLenCP: '$code' } } } },
  ]);

  const user = await User.findById(req.user._id);

  res.status(200).json({
    success: true,
    stats: {
      totalSnippets: snippetCount,
      memberSince: user.createdAt,
      lastActive: user.lastLogin,
      languageBreakdown: languageStats,
      totalCodeSize: sizeStats?.totalSize || 0,
    },
  });
});

exports.searchSnippets = asyncHandler(async (req, res) => {
  const { query } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  if (!query || query.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Search query is required',
    });
  }

  const snippets = await CodeSnippet.find(
    {
      userId: req.user._id,
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { code: { $regex: query, $options: 'i' } },
      ],
    },
    { code: 0 }
  )
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await CodeSnippet.countDocuments({
    userId: req.user._id,
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { code: { $regex: query, $options: 'i' } },
    ],
  });

  res.status(200).json({
    success: true,
    query,
    snippets,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

exports.exportSnippets = asyncHandler(async (req, res) => {
  const snippets = await CodeSnippet.find({ userId: req.user._id }).select(
    '-__v'
  );

  const exportData = {
    user: req.user.email,
    exportDate: new Date().toISOString(),
    snippetCount: snippets.length,
    snippets: snippets,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="snippets-export.json"'
  );

  res.status(200).json(exportData);
});

exports.importSnippets = asyncHandler(async (req, res) => {
  const { snippets } = req.body;

  if (!Array.isArray(snippets) || snippets.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Snippets array is required',
    });
  }

  const validSnippets = snippets
    .filter((s) => s.language && s.code)
    .map((s) => ({
      userId: req.user._id,
      language: s.language.toLowerCase(),
      code: s.code,
      title: s.title ? s.title.substring(0, 100) : 'Imported Snippet',
    }));

  if (validSnippets.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid snippets found to import',
    });
  }

  const result = await CodeSnippet.insertMany(validSnippets);

  res.status(201).json({
    success: true,
    message: `${result.length} snippets imported successfully`,
    importedCount: result.length,
    snippets: result.map((s) => ({
      id: s._id,
      title: s.title,
      language: s.language,
    })),
  });
});

exports.getActivity = asyncHandler(async (req, res) => {
  const { limit = 20 } = req.query;

  const recentSnippets = await CodeSnippet.find({ userId: req.user._id })
    .select('title language createdAt')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  const user = await User.findById(req.user._id);

  res.status(200).json({
    success: true,
    activity: {
      accountCreated: user.createdAt,
      lastLogin: user.lastLogin,
      recentActivity: recentSnippets,
    },
  });
});
