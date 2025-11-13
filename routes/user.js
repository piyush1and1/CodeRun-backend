const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const verifyJWT = require("../middleware/VerifyJWT");

const { 
  snippetLimiter, 
  exportImportLimiter 
} = require("../middleware/rateLimiter");

// All user routes require authentication
router.use(verifyJWT);

// Profile
router.get("/profile", userController.getProfile);
router.put("/profile", userController.updateProfile);

// Stats & Activity
router.get("/stats", userController.getStats);
router.get("/activity", userController.getActivity);

// Snippet Search
router.get("/snippets/search/:query", userController.searchSnippets);

// Snippet CRUD
router.post("/snippets", snippetLimiter, userController.saveSnippet);
router.get("/snippets", userController.getSnippets);
router.delete("/snippets", snippetLimiter, userController.deleteMultipleSnippets);

router.get("/snippets/:snippetId", userController.getSnippet);
router.put("/snippets/:snippetId", snippetLimiter, userController.updateSnippet);
router.delete("/snippets/:snippetId", snippetLimiter, userController.deleteSnippet);

// Import / Export
router.get("/export", exportImportLimiter, userController.exportSnippets);
router.post("/import", exportImportLimiter, userController.importSnippets);

module.exports = router;
