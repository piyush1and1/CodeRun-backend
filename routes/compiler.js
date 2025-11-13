const router = require("express").Router();
const compilerController = require("../controllers/compilerController");
const { compileLimiter } = require("../middleware/rateLimiter");
const checkAuth = require("../middleware/checkAuth");

router.post(
  "/compile",
  checkAuth,
  compileLimiter,
  compilerController.compileCode
);

module.exports = router;