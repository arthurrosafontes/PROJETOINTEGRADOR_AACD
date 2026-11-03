
const router = require('express').Router();
const multer = require('multer');
const { login, sair, perfil, verFoto, enviarFoto } = require('../controllers/authController');
const { exigirAutenticacao } = require('../middleware/autenticacao');

// Foto de perfil: até 2 MB, guardada na memória até o controller salvar
const uploadFoto = multer({ limits: { fileSize: 2 * 1024 * 1024 } }).single('foto');
const receberFoto = (req, res, next) => uploadFoto(req, res, erro =>
  erro ? res.status(400).json({ erro: 'Envie uma única foto de até 2 MB.' }) : next());

router.post('/login', login);

router.get('/me', exigirAutenticacao, (req, res) => {
    res.json({ usuario: req.usuario });
});

router.get('/perfil', exigirAutenticacao, perfil);
router.get('/perfil/foto', exigirAutenticacao, verFoto);
router.put('/perfil/foto', exigirAutenticacao, receberFoto, enviarFoto);

router.post('/logout', sair);

module.exports = router;
