
const router = require('express').Router();
const { login, sair } = require('../controllers/authController');
const { exigirAutenticacao } = require('../middleware/autenticacao');

router.post('/login', login);

router.get('/me', exigirAutenticacao, (req, res) => {
    res.json({ usuario: req.usuario });
});

router.post('/logout', sair);

module.exports = router;

