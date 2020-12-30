const express = require('express');
const router = express.Router();
const FileServer = require('../modules/FileServer');
const fileUpload   = require('express-fileupload');

router.get('/file/:fileId/data', async function (req, res) {
  await FileServer.file_data({req, res})
});

router.get('/file/:fileId/download', async function (req, res) {
  await FileServer.file({req, res, fileId: req.params.fileId, download: true})
});

router.get('/file/:fileId', async function (req, res) {
  await FileServer.file({req, res, fileId: req.params.fileId})
});

router.get('/files', async function (req, res) {
  await FileServer.files({req, res})
});

router.post('/file', fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  useTempFiles : true,
  tempFileDir : './tmp/',
}), async function (req, res) {
  await FileServer.fileUpload({req, res})
});

router.delete('/file/:fileId', async function (req, res) {
  await FileServer.fileDelete({req, res, fileId: req.params.fileId})
});

router.get('/', function (req, res) {
  res.send('<!DOCTYPE html>\n' +
    '<html lang="ru">\n' +
    ' <head>\n' +
    '  <meta charset="utf-8">\n' +
    '  <title>Отправка файла на сервер</title>\n' +
    ' </head>\n' +
    ' <body>\n' +
    '  <form action="/file" enctype="multipart/form-data" method="post">\n' +
    '   <input type="file" name="file">\n' +
    '   <input type="hidden" name="ss_token" value="6af4492dde1904d5de1d03e242da6f04">\n' +
    '   <input type="submit" value="Отправить">\n' +
    '  </form> \n' +
    ' </body>\n' +
    '</html>')
});

module.exports = router;
